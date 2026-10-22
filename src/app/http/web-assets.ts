const assets = {
	index: {
		contentType: 'text/html; charset=utf-8',
		path: new URL('../web/index.html', import.meta.url),
	},
	script: {
		contentType: 'text/javascript; charset=utf-8',
		path: new URL('../web/main.js', import.meta.url),
	},
	stylesheet: {
		contentType: 'text/css; charset=utf-8',
		path: new URL('../web/styles.css', import.meta.url),
	},
} as const;

export function serveWebAsset(pathname: string): Response {
	const asset = pathname.endsWith('/styles.css')
		? assets.stylesheet
		: pathname.endsWith('/main.js')
			? assets.script
			: assets.index;

	return new Response(Bun.file(asset.path), {
		headers: { 'Content-Type': asset.contentType },
	});
}
