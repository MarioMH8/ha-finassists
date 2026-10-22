const securityHeaders: Record<string, string> = {
	'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'SAMEORIGIN',
};

export function withSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);

	for (const [name, value] of Object.entries(securityHeaders)) {
		headers.set(name, value);
	}

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}
