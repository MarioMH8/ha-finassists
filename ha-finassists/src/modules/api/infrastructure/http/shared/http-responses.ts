const JSON_NULL = JSON.parse('null') as null;

class HttpResponses {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
		return Response.json(body, {
			headers: { 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(headers)) },
			status,
		});
	}

	static methodNotAllowed(allow: string): Response {
		return this.json({ error: 'Method not allowed' }, 405, { Allow: allow });
	}

	static noContent(): Response {
		return new Response(JSON_NULL, { status: 204 });
	}
}

export { HttpResponses, JSON_NULL };
