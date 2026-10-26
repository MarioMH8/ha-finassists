import type {
	RequestContext,
	SystemCredentialUseCases,
	TokenManagementUseCases,
} from '@modules/api/infrastructure/http/shared/request-context';
import type { IngressActor } from '@modules/home-assistant';
import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';

type FinancialActor = IngressActor;

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status });
}

function bearerSecret(request: Request): string | undefined {
	const authorizationParts = (request.headers.get('authorization') ?? '').trim().split(/\s+/u, 3);
	const [scheme = '', secret = ''] = authorizationParts;

	return secret && authorizationParts.length === 2 && scheme.toLowerCase() === 'bearer' ? secret : undefined;
}

async function authenticateSystemBearer(
	request: Request,
	systemCredentialUseCases: SystemCredentialUseCases
): Promise<FinancialActor | Response> {
	const secret = bearerSecret(request);
	if (secret === undefined) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	const credential = await systemCredentialUseCases.authenticate.execute(secret);

	return credential
		? { id: credential.id, kind: 'home_assistant_integration' }
		: jsonResponse({ error: 'Authentication required' }, 401);
}

async function authenticateBearer(
	request: Request,
	tokenUseCases: TokenManagementUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<FinancialActor | Response> {
	const secret = bearerSecret(request);
	if (secret === undefined) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	if (systemCredentialUseCases !== undefined) {
		const credential = await systemCredentialUseCases.authenticate.execute(secret);
		if (credential) {
			return { id: credential.id, kind: 'home_assistant_integration' };
		}
	}

	const token = await tokenUseCases.authenticate.execute(secret);
	if (!token) {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}

	return { id: token.ownerId, kind: 'home_assistant_user' };
}

async function authenticateFinancialRequest(
	request: Request,
	context: RequestContext,
	tokenUseCases: TokenManagementUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<FinancialActor | Response> {
	const secret = bearerSecret(request);
	if (systemCredentialUseCases !== undefined && secret !== undefined) {
		const credential = await systemCredentialUseCases.authenticate.execute(secret);
		if (credential) {
			return { id: credential.id, kind: 'home_assistant_integration' };
		}
	}
	if (context.developmentActor !== undefined) {
		return context.developmentActor;
	}

	if (isTrustedIngressPeer(context.remoteAddress, context.trustedIngressIp)) {
		return resolveIngressActor(request.headers, context.remoteAddress, context.trustedIngressIp);
	}

	return authenticateBearer(request, tokenUseCases, systemCredentialUseCases);
}

export { authenticateBearer, authenticateFinancialRequest, authenticateSystemBearer, bearerSecret };
