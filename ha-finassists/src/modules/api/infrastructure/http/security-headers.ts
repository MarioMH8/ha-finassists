import { HttpResponses } from './shared/http-responses';

const contentSecurityPolicy = [
	`default-src \u{27}self\u{27}`,
	`object-src \u{27}none\u{27}`,
	`base-uri \u{27}self\u{27}`,
	`frame-ancestors \u{27}self\u{27}`,
].join('; ');

const securityHeaders: Record<string, string> = {
	'Content-Security-Policy': contentSecurityPolicy,
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'SAMEORIGIN',
};

class SecurityHeaders {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static apply(response: Response): Response {
		const headers = new Headers(response.headers);

		for (const [name, value] of Object.entries(securityHeaders)) {
			headers.set(name, value);
		}

		return HttpResponses.withHeaders(response, headers);
	}
}

export { SecurityHeaders };
