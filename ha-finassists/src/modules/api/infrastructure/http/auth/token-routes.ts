import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import type { HttpEnvironment, TokenManagementUseCases } from '@modules/api/infrastructure/http/shared/request-context';
import { IngressActorResolver, TrustedIngressPeer } from '@modules/home-assistant';
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

	if (!TrustedIngressPeer.isTrusted(remoteAddress, trustedIngressIp)) {
		return HttpResponses.text('Forbidden', 403, { 'Cache-Control': 'no-store' });
	}

	const actor = IngressActorResolver.resolve(context.req.raw.headers, remoteAddress, trustedIngressIp);
	if (actor.kind === 'unknown') {
		return HttpResponses.text('Unauthorized', 401, { 'Cache-Control': 'no-store' });
	}
	context.set('actor', { id: actor.id });

	return next();
});

class TokenRoutes {
	private constructor() {}

	static create(): Hono<TokenEnvironment> {
		const routes = new Hono<TokenEnvironment>();

		routes
			.get('/', requireTokenActor, async context => {
				const tokens = await context.var.di.get('tokenUseCases').list.execute(context.var.actor.id);

				return HttpResponses.json(tokens.map(token => this.tokenMetadata(token)));
			})
			.post('/', requireTokenActor, async context => {
				let body: unknown;
				try {
					body = await context.req.json();
				} catch {
					return HttpResponses.json({ error: 'Invalid JSON body' }, 400);
				}

				const input = issueTokenSchema.safeParse(body);
				if (!input.success) {
					return HttpResponses.json({ error: INVALID_TOKEN_NAME }, 400);
				}

				try {
					const issued = await context.var.di
						.get('tokenUseCases')
						.issue.execute({ name: input.data.name, ownerId: context.var.actor.id });

					return HttpResponses.json({ ...this.tokenMetadata(issued.token), secret: issued.secret }, 201);
				} catch (error) {
					if (error instanceof Error && error.name === 'TokenNameRequiredError') {
						return HttpResponses.json({ error: INVALID_TOKEN_NAME }, 400);
					}

					throw error;
				}
			})
			.all('/', () => HttpResponses.methodNotAllowed('GET, POST'));

		routes
			.delete('/:id', requireTokenActor, async context => {
				const isRevoked = await context.var.di.get('tokenUseCases').revoke.execute({
					id: context.req.param('id'),
					ownerId: context.var.actor.id,
				});

				return isRevoked ? HttpResponses.noContent() : HttpResponses.text('Not Found', 404);
			})
			.all('/:id', () => HttpResponses.methodNotAllowed('DELETE'));

		return routes;
	}

	private static tokenMetadata(token: Awaited<ReturnType<TokenManagementUseCases['list']['execute']>>[number]) {
		return {
			createdAt: token.createdAt,
			id: token.id,
			name: token.name,
			prefix: token.prefix,
		};
	}
}

export { TokenRoutes };
