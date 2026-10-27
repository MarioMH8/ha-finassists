import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';

class RequestTooLargeError extends Error {}

class FinanceRouteError {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static toResponse(error: unknown): Response {
		if (error instanceof RequestTooLargeError) {
			return HttpResponses.json({ error: error.message }, 413);
		}
		if (error instanceof TypeError || error instanceof RangeError) {
			return HttpResponses.json({ error: error.message }, 400);
		}
		if (error instanceof Error) {
			if (error.name === 'SQLiteError') {
				return HttpResponses.json({ error: 'The request could not be completed' }, 500);
			}
			const message = error.message;
			if (/not found|does not exist/iu.test(message)) {
				return HttpResponses.json({ error: message }, 404);
			}
			if (/already exists|cannot/iu.test(message)) {
				return HttpResponses.json({ error: message }, 409);
			}

			return HttpResponses.json({ error: message }, 400);
		}

		return HttpResponses.json({ error: 'The request could not be completed' }, 500);
	}
}

export { FinanceRouteError, RequestTooLargeError };
