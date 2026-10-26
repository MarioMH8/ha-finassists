import { jsonResponse, methodNotAllowed, noContent } from '@modules/api/infrastructure/http/shared/http-responses';
import type { HttpEnvironment } from '@modules/api/infrastructure/http/shared/request-context';
import { Hono } from 'hono';
import { z } from 'zod';

import { authenticateSystemBearer, bearerSecret } from './authentication';

const exchangeSchema = z.object({
	bootstrapCapability: z.string().min(32).max(4096),
});

export function createSystemCredentialRoutes(): Hono<HttpEnvironment> {
	const routes = new Hono<HttpEnvironment>();

	routes
		.post('/exchange', async context => {
			const useCases = context.var.di.get('systemCredentialUseCases');
			if (useCases === undefined) {
				return jsonResponse({ error: 'System credential bootstrap is not configured' }, 503);
			}

			let body: unknown;
			try {
				body = await context.req.json();
			} catch {
				return jsonResponse({ error: 'Invalid JSON body' }, 400);
			}

			const input = exchangeSchema.safeParse(body);
			if (!input.success) {
				return jsonResponse({ error: 'A valid bootstrapCapability is required' }, 400);
			}

			const issued = await useCases.exchange.execute(input.data.bootstrapCapability);

			return issued
				? jsonResponse(issued, 201)
				: jsonResponse({ error: 'Bootstrap capability is invalid or expired' }, 401);
		})
		.all('/exchange', () => methodNotAllowed('POST'));

	routes
		.put('/current', async context => {
			const useCases = context.var.di.get('systemCredentialUseCases');
			if (useCases === undefined) {
				return new Response(undefined, { status: 404 });
			}
			const actor = await authenticateSystemBearer(context.req.raw, useCases);
			if (actor instanceof Response) {
				return actor;
			}
			const secret = bearerSecret(context.req.raw);
			const rotated = secret === undefined ? undefined : await useCases.rotate.execute(secret);

			return rotated ? jsonResponse(rotated) : jsonResponse({ error: 'Authentication required' }, 401);
		})
		.delete('/current', async context => {
			const useCases = context.var.di.get('systemCredentialUseCases');
			if (useCases === undefined) {
				return new Response(undefined, { status: 404 });
			}
			const actor = await authenticateSystemBearer(context.req.raw, useCases);
			if (actor instanceof Response) {
				return actor;
			}
			const secret = bearerSecret(context.req.raw);
			if (secret === undefined) {
				return jsonResponse({ error: 'Authentication required' }, 401);
			}

			return (await useCases.revoke.execute(secret)) ? noContent() : new Response('Not Found', { status: 404 });
		})
		.all('/current', () => methodNotAllowed('PUT, DELETE'));

	return routes;
}
