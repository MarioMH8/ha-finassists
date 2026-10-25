import { Buffer } from 'node:buffer';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Language } from '@app/i18n/language';
import { LANGUAGE } from '@app/i18n/language';
import type { ShellConfig } from '@modules/shell/domain';

interface ServerRenderer {
	renderPage(
		language: Language,
		isDevelopmentMode: boolean,
		settings: ShellConfig
	): Promise<ReadableStream<Uint8Array>>;
}

interface BuiltWebAssets {
	clientScript: string;
	renderer: ServerRenderer;
	stylesheet: string;
}

const sourceDirectory = fileURLToPath(new URL('../../../../app', import.meta.url));
const productionStylesheet = new URL('styles.css', import.meta.url);
const productionClientBundle = new URL('client.js', import.meta.url);
const productionRendererBundle = new URL('server-renderer.js', import.meta.url);
const developmentVersion = crypto.randomUUID();
const assetCache: {
	development: { promise?: Promise<BuiltWebAssets>; sourceVersion?: string };
	productionRenderer?: Promise<ServerRenderer>;
} = { development: {} };

async function getSourceVersion(directory: string): Promise<string> {
	const entries = await readdir(directory, { withFileTypes: true });
	const versions = await Promise.all(
		entries.map(async entry => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return `${entry.name}/{${await getSourceVersion(entryPath)}}`;
			}

			const file = await stat(entryPath);

			return `${entry.name}:${String(file.mtimeMs)}:${String(file.size)}`;
		})
	);

	return versions.toSorted((first, second) => first.localeCompare(second)).join('|');
}

async function buildBundle(
	entrypoint: URL,
	target: 'browser' | 'bun'
): Promise<{ script: string; stylesheet: string }> {
	const result = await Bun.build({
		entrypoints: [entrypoint.pathname],
		format: 'esm',
		jsx: { runtime: 'automatic' },
		minify: target === 'browser',
		packages: 'bundle',
		target,
	});
	if (!result.success) {
		throw new Error(`Could not build ${target} web assets: ${result.logs.map(log => log.message).join(' | ')}`);
	}

	const script = result.outputs.find(output => output.path.endsWith('.js'));
	if (script === undefined) {
		throw new Error(`${target} web asset build produced no JavaScript output`);
	}

	const stylesheet = result.outputs.find(output => output.path.endsWith('.css'));

	return { script: await script.text(), stylesheet: stylesheet === undefined ? '' : await stylesheet.text() };
}

async function buildWebAssets(): Promise<BuiltWebAssets> {
	const [client, rendererBundle] = await Promise.all([
		buildBundle(new URL('../../../../app/client.tsx', import.meta.url), 'browser'),
		buildBundle(new URL('../../../../app/shell/server-renderer.tsx', import.meta.url), 'bun'),
	]);
	const rendererUrl = `data:text/javascript;base64,${Buffer.from(rendererBundle.script).toString('base64')}`;
	const renderer = (await import(rendererUrl)) as ServerRenderer;

	return { clientScript: client.script, renderer, stylesheet: rendererBundle.stylesheet };
}

async function getDevelopmentAssets(): Promise<BuiltWebAssets> {
	const sourceVersion = await getSourceVersion(sourceDirectory);
	if (sourceVersion !== assetCache.development.sourceVersion) {
		assetCache.development = { sourceVersion };
	}

	assetCache.development.promise ??= buildWebAssets();

	return assetCache.development.promise;
}

async function getDevelopmentRenderer(): Promise<ServerRenderer> {
	const assets = await getDevelopmentAssets();

	return assets.renderer;
}

async function getProductionRenderer(): Promise<ServerRenderer> {
	assetCache.productionRenderer ??= import(productionRendererBundle.href) as Promise<ServerRenderer>;

	return assetCache.productionRenderer;
}

function getLanguage(request: Request): Language {
	const acceptLanguage = request.headers.get('accept-language') ?? '';
	const isPrefersSpanish = acceptLanguage
		.split(',')
		.some(locale => locale.trim().split(';', 1)[0]?.toLowerCase().startsWith('es'));

	return isPrefersSpanish ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;
}

async function serveHtml(request: Request, isDevelopmentMode: boolean, settings: ShellConfig): Promise<Response> {
	const language = getLanguage(request);
	const renderer =
		!isDevelopmentMode && Bun.env.NODE_ENV === 'production'
			? await getProductionRenderer()
			: await getDevelopmentRenderer();
	const stream = await renderer.renderPage(language, isDevelopmentMode, settings);

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			Vary: 'Accept-Language',
		},
	});
}

async function prepareWebAssets(isDevelopmentMode: boolean): Promise<void> {
	if (isDevelopmentMode || Bun.env.NODE_ENV !== 'production') {
		await getDevelopmentAssets();

		return;
	}

	await Promise.all([
		Bun.file(productionClientBundle).text(),
		Bun.file(productionStylesheet).text(),
		getProductionRenderer(),
	]);
}

async function serveWebAsset(
	pathname: string,
	request: Request,
	isDevelopmentMode: boolean,
	settings: ShellConfig
): Promise<Response> {
	if (isDevelopmentMode && pathname.endsWith('/__dev/version')) {
		return new Response(`${developmentVersion}:${await getSourceVersion(sourceDirectory)}`, {
			headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
		});
	}

	if (isDevelopmentMode && pathname.endsWith('/__dev/reload.js')) {
		return new Response(
			`let currentVersion;\nconst checkVersion = async () => {\n  try {\n    const response = await fetch('./__dev/version', { cache: 'no-store' });\n    const nextVersion = await response.text();\n    if (currentVersion && currentVersion !== nextVersion) location.reload();\n    currentVersion = nextVersion;\n  } catch {}\n};\nvoid checkVersion();\nsetInterval(checkVersion, 1500);`,
			{ headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/javascript; charset=utf-8' } }
		);
	}

	if (pathname.endsWith('/styles.css')) {
		if (!isDevelopmentMode && Bun.env.NODE_ENV === 'production') {
			return new Response(Bun.file(productionStylesheet), {
				headers: { 'Content-Type': 'text/css; charset=utf-8' },
			});
		}

		const assets = await getDevelopmentAssets();

		return new Response(assets.stylesheet, {
			headers: { 'Content-Type': 'text/css; charset=utf-8' },
		});
	}

	if (pathname.endsWith('/client.js')) {
		const assets =
			!isDevelopmentMode && Bun.env.NODE_ENV === 'production' ? undefined : await getDevelopmentAssets();
		const clientScript = assets?.clientScript ?? (await Bun.file(productionClientBundle).text());

		return new Response(clientScript, {
			headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
		});
	}

	return serveHtml(request, isDevelopmentMode, settings);
}

export { prepareWebAssets, serveWebAsset };
