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

class WebAssets {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async prepare(isDevelopmentMode: boolean): Promise<void> {
		if (isDevelopmentMode || Bun.env.NODE_ENV !== 'production') {
			await this.getDevelopmentAssets();

			return;
		}

		await Promise.all([
			Bun.file(productionClientBundle).text(),
			Bun.file(productionStylesheet).text(),
			this.getProductionRenderer(),
		]);
	}

	static async serve(
		pathname: string,
		request: Request,
		isDevelopmentMode: boolean,
		settings: ShellConfig
	): Promise<Response> {
		if (isDevelopmentMode && pathname.endsWith('/__dev/version')) {
			return new Response(`${developmentVersion}:${await this.getSourceVersion(sourceDirectory)}`, {
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

			const assets = await this.getDevelopmentAssets();

			return new Response(assets.stylesheet, {
				headers: { 'Content-Type': 'text/css; charset=utf-8' },
			});
		}

		if (pathname.endsWith('/client.js')) {
			const assets =
				!isDevelopmentMode && Bun.env.NODE_ENV === 'production' ? undefined : await this.getDevelopmentAssets();
			const clientScript = assets?.clientScript ?? (await Bun.file(productionClientBundle).text());

			return new Response(clientScript, {
				headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
			});
		}

		return this.serveHtml(request, isDevelopmentMode, settings);
	}

	private static async buildBundle(
		entrypoint: URL,
		target: 'browser' | 'bun'
	): Promise<{ script: string; stylesheet: string }> {
		const result = await Bun.build({
			entrypoints: [entrypoint.pathname],
			/*
			 * Home Assistant serves Roboto from its own `/static/fonts` path, which
			 * the Ingress iframe resolves against the Home Assistant origin. Keep
			 * that URL external so the CSS bundler does not look for an app asset.
			 */
			external: ['/static/*'],
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

	private static async buildWebAssets(): Promise<BuiltWebAssets> {
		const [client, rendererBundle] = await Promise.all([
			this.buildBundle(new URL('../../../../app/client.tsx', import.meta.url), 'browser'),
			this.buildBundle(new URL('../../../../app/shell/server-renderer.tsx', import.meta.url), 'bun'),
		]);
		const rendererUrl = `data:text/javascript;base64,${Buffer.from(rendererBundle.script).toString('base64')}`;
		const renderer = (await import(rendererUrl)) as ServerRenderer;

		return { clientScript: client.script, renderer, stylesheet: rendererBundle.stylesheet };
	}

	private static async getDevelopmentAssets(): Promise<BuiltWebAssets> {
		const sourceVersion = await this.getSourceVersion(sourceDirectory);
		if (sourceVersion !== assetCache.development.sourceVersion) {
			assetCache.development = { sourceVersion };
		}

		assetCache.development.promise ??= this.buildWebAssets();

		return assetCache.development.promise;
	}

	private static async getDevelopmentRenderer(): Promise<ServerRenderer> {
		const assets = await this.getDevelopmentAssets();

		return assets.renderer;
	}

	private static getLanguage(request: Request): Language {
		const acceptLanguage = request.headers.get('accept-language') ?? '';
		const isPrefersSpanish = acceptLanguage
			.split(',')
			.some(locale => locale.trim().split(';', 1)[0]?.toLowerCase().startsWith('es'));

		return isPrefersSpanish ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;
	}

	private static async getProductionRenderer(): Promise<ServerRenderer> {
		assetCache.productionRenderer ??= import(productionRendererBundle.href) as Promise<ServerRenderer>;

		return assetCache.productionRenderer;
	}

	private static async getSourceVersion(directory: string): Promise<string> {
		const entries = await readdir(directory, { withFileTypes: true });
		const versions = await Promise.all(
			entries.map(async entry => {
				const entryPath = path.join(directory, entry.name);
				if (entry.isDirectory()) {
					return `${entry.name}/{${await this.getSourceVersion(entryPath)}}`;
				}

				const file = await stat(entryPath);

				return `${entry.name}:${String(file.mtimeMs)}:${String(file.size)}`;
			})
		);

		return versions.toSorted((first, second) => first.localeCompare(second)).join('|');
	}

	private static async serveHtml(
		request: Request,
		isDevelopmentMode: boolean,
		settings: ShellConfig
	): Promise<Response> {
		const language = this.getLanguage(request);
		const renderer =
			!isDevelopmentMode && Bun.env.NODE_ENV === 'production'
				? await this.getProductionRenderer()
				: await this.getDevelopmentRenderer();
		const stream = await renderer.renderPage(language, isDevelopmentMode, settings);

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				Vary: 'Accept-Language',
			},
		});
	}
}

export { WebAssets };
