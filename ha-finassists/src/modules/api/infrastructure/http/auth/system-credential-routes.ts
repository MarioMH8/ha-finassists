import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import type { HttpEnvironment } from '@modules/api/infrastructure/http/shared/request-context';
import { Hono } from 'hono';
import { z } from 'zod';

import { FinancialAuthentication } from './financial-authentication';

const exchangeSchema = z.object({
	bootstrapCapability: z.string().min(32).max(4096),
});

class SystemCredentialRoutes {
	private constructor() {}

	static create(): Hono<HttpEnvironment> {
		const routes = new Hono<HttpEnvironment>();

		routes
			.post('/exchange', async context => {
				const useCases = context.var.di.get('systemCredentialUseCases');
				if (useCases === undefined) {
					return HttpResponses.json({ error: 'System credential bootstrap is not configured' }, 503);
				}

				let body: unknown;
				try {
					body = await context.req.json();
				} catch {
					return HttpResponses.json({ error: 'Invalid JSON body' }, 400);
				}

				const input = exchangeSchema.safeParse(body);
				if (!input.success) {
					return HttpResponses.json({ error: 'A valid bootstrapCapability is required' }, 400);
				}

				const issued = await useCases.exchange.execute(input.data.bootstrapCapability);

				return issued
					? HttpResponses.json(issued, 201)
					: HttpResponses.json({ error: 'Bootstrap capability is invalid or expired' }, 401);
			})
			.all('/exchange', () => HttpResponses.methodNotAllowed('POST'));

		routes
			.put('/current', async context => {
				const useCases = context.var.di.get('systemCredentialUseCases');
				if (useCases === undefined) {
					return HttpResponses.empty(404);
				}
				const authenticated = await FinancialAuthentication.authenticateSystemBearer(context.req.raw, useCases);
				if (authenticated instanceof Response) {
					return authenticated;
				}
				const rotated = await useCases.rotate.execute(authenticated.secret);

				return rotated
					? HttpResponses.json(rotated)
					: HttpResponses.json({ error: 'Authentication required' }, 401);
			})
			.delete('/current', async context => {
				const useCases = context.var.di.get('systemCredentialUseCases');
				if (useCases === undefined) {
					return HttpResponses.empty(404);
				}
				const authenticated = await FinancialAuthentication.authenticateSystemBearer(context.req.raw, useCases);
				if (authenticated instanceof Response) {
					return authenticated;
				}

				return (await useCases.revoke.execute(authenticated.secret))
					? HttpResponses.noContent()
					: HttpResponses.text('Not Found', 404);
			})
			.all('/current', () => HttpResponses.methodNotAllowed('PUT, DELETE'));

		return routes;
	}
}

export { SystemCredentialRoutes };
