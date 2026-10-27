const JSON_NULL = JSON.parse('null') as null;

class HttpResponses {
	private constructor() {}

	static body(value: BodyInit, status = 200, headers: HeadersInit = {}): Response {
		return new Response(value, { headers, status });
	}

	static empty(status = 200, headers: HeadersInit = {}): Response {
		return new Response(undefined, { headers, status });
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
		return this.empty(204);
	}

	static text(body: string, status = 200, headers: HeadersInit = {}): Response {
		return new Response(body, { headers, status });
	}

	static withHeaders(response: Response, headers: HeadersInit): Response {
		return new Response(response.body, {
			headers,
			status: response.status,
			statusText: response.statusText,
		});
	}
}

export { HttpResponses, JSON_NULL };
