const JSON_NULL = JSON.parse('null') as null;

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		headers: { 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(headers)) },
		status,
	});
}

function noContent(): Response {
	return new Response(JSON_NULL, { status: 204 });
}

function methodNotAllowed(allow: string): Response {
	return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: allow });
}

export { JSON_NULL, jsonResponse, methodNotAllowed, noContent };
