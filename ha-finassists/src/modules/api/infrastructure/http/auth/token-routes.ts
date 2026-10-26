import { jsonResponse, methodNotAllowed, noContent } from '@modules/api/infrastructure/http/shared/http-responses';
import type { HttpEnvironment, TokenManagementUseCases } from '@modules/api/infrastructure/http/shared/request-context';
import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';

interface TokenEnvironment extends HttpEnvironment {
	Variables: HttpEnvironment['Variables'] & { actor: { id: string } };
}

const INVALID_TOKEN_NAME = 'Token name must contain between 1 and 80 characters';

const issueTokenSchema = z.object({
	name: z.string().refine(name => name.trim().length <= 80),
});

const requireTokenActor = createMiddleware<TokenEnvironment>(async (context, next) => {
	const { developmentActor, remoteAddress, trustedIngressIp } = context.env.requestContext;
	if (developmentActor !== undefined) {
		context.set('actor', { id: developmentActor.id });

		return next();
	}

	if (!isTrustedIngressPeer(remoteAddress, trustedIngressIp)) {
		return new Response('Forbidden', { headers: { 'Cache-Control': 'no-store' }, status: 403 });
	}

	const actor = resolveIngressActor(context.req.raw.headers, remoteAddress, trustedIngressIp);
	if (actor.kind === 'unknown') {
		return new Response('Unauthorized', { headers: { 'Cache-Control': 'no-store' }, status: 401 });
	}
	context.set('actor', { id: actor.id });

	return next();
});

function tokenMetadata(token: Awaited<ReturnType<TokenManagementUseCases['list']['execute']>>[number]) {
	return {
		createdAt: token.createdAt,
		id: token.id,
		name: token.name,
		prefix: token.prefix,
	};
}

export function createTokenRoutes(): Hono<TokenEnvironment> {
	const routes = new Hono<TokenEnvironment>();

	routes
		.get('/', requireTokenActor, async context => {
			const tokens = await context.var.di.get('tokenUseCases').list.execute(context.var.actor.id);

			return jsonResponse(tokens.map(token => tokenMetadata(token)));
		})
		.post('/', requireTokenActor, async context => {
			let body: unknown;
			try {
				body = await context.req.json();
			} catch {
				return jsonResponse({ error: 'Invalid JSON body' }, 400);
			}

			const input = issueTokenSchema.safeParse(body);
			if (!input.success) {
				return jsonResponse({ error: INVALID_TOKEN_NAME }, 400);
			}

			try {
				const issued = await context.var.di
					.get('tokenUseCases')
					.issue.execute({ name: input.data.name, ownerId: context.var.actor.id });

				return jsonResponse({ ...tokenMetadata(issued.token), secret: issued.secret }, 201);
			} catch (error) {
				if (error instanceof Error && error.name === 'TokenNameRequiredError') {
					return jsonResponse({ error: INVALID_TOKEN_NAME }, 400);
				}

				throw error;
			}
		})
		.all('/', () => methodNotAllowed('GET, POST'));

	routes
		.delete('/:id', requireTokenActor, async context => {
			const isRevoked = await context.var.di.get('tokenUseCases').revoke.execute({
				id: context.req.param('id'),
				ownerId: context.var.actor.id,
			});

			return isRevoked ? noContent() : new Response('Not Found', { status: 404 });
		})
		.all('/:id', () => methodNotAllowed('DELETE'));

	return routes;
}
