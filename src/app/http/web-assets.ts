import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';

import { WebPage } from '../web/document';
import type { Language } from '../web/language';
import { LANGUAGE } from '../web/language';

const stylesheet = new URL('../web/styles.css', import.meta.url);
const clientBundle = { promise: undefined as Promise<string> | undefined };

async function buildClientBundle(): Promise<string> {
	const result = await Bun.build({
		entrypoints: [new URL('../web/client.tsx', import.meta.url).pathname],
		format: 'esm',
		jsx: { runtime: 'automatic' },
		minify: true,
		packages: 'bundle',
	});
	if (!result.success) {
		throw new Error(`Could not build the client application: ${result.logs.map(log => log.message).join(' | ')}`);
	}
	const bundle = result.outputs.at(0);
	if (bundle === undefined) {
		throw new Error('Client application build produced no output');
	}

	return bundle.text();
}

async function getClientBundle(): Promise<string> {
	clientBundle.promise ??= buildClientBundle();

	return await clientBundle.promise;
}

function getLanguage(request: Request): Language {
	const acceptLanguage = request.headers.get('accept-language') ?? '';
	const isPrefersSpanish = acceptLanguage
		.split(',')
		.some(locale => locale.trim().split(';', 1)[0]?.toLowerCase().startsWith('es'));

	return isPrefersSpanish ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;
}

async function serveHtml(request: Request): Promise<Response> {
	const language = getLanguage(request);
	const stream = await renderToReadableStream(createElement(WebPage, { language }));

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			Vary: 'Accept-Language',
		},
	});
}

async function prepareWebAssets(): Promise<void> {
	await getClientBundle();
}

async function serveWebAsset(pathname: string, request: Request): Promise<Response> {
	if (pathname.endsWith('/styles.css')) {
		return new Response(Bun.file(stylesheet), {
			headers: { 'Content-Type': 'text/css; charset=utf-8' },
		});
	}

	if (pathname.endsWith('/client.js')) {
		return new Response(await getClientBundle(), {
			headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
		});
	}

	return serveHtml(request);
}

export { prepareWebAssets, serveWebAsset };
