import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import type {
	RequestContext,
	SystemCredentialUseCases,
	TokenManagementUseCases,
} from '@modules/api/infrastructure/http/shared/request-context';
import type { IngressActor } from '@modules/home-assistant';
import { isTrustedIngressPeer, resolveIngressActor } from '@modules/home-assistant';

type FinancialActor = IngressActor;

interface AuthenticatedSystemBearer {
	actor: FinancialActor;
	secret: string;
}

class FinancialAuthentication {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async authenticate(
		request: Request,
		context: RequestContext,
		tokenUseCases: TokenManagementUseCases,
		systemCredentialUseCases?: SystemCredentialUseCases
	): Promise<FinancialActor | Response> {
		const secret = this.bearerSecret(request);
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

		return this.authenticateBearer(request, tokenUseCases, systemCredentialUseCases);
	}

	static async authenticateSystemBearer(
		request: Request,
		systemCredentialUseCases: SystemCredentialUseCases
	): Promise<AuthenticatedSystemBearer | Response> {
		const secret = this.bearerSecret(request);
		if (secret === undefined) {
			return HttpResponses.json({ error: 'Authentication required' }, 401);
		}

		const credential = await systemCredentialUseCases.authenticate.execute(secret);

		return credential
			? { actor: { id: credential.id, kind: 'home_assistant_integration' }, secret }
			: HttpResponses.json({ error: 'Authentication required' }, 401);
	}

	private static async authenticateBearer(
		request: Request,
		tokenUseCases: TokenManagementUseCases,
		systemCredentialUseCases?: SystemCredentialUseCases
	): Promise<FinancialActor | Response> {
		const secret = this.bearerSecret(request);
		if (secret === undefined) {
			return HttpResponses.json({ error: 'Authentication required' }, 401);
		}

		if (systemCredentialUseCases !== undefined) {
			const credential = await systemCredentialUseCases.authenticate.execute(secret);
			if (credential) {
				return { id: credential.id, kind: 'home_assistant_integration' };
			}
		}

		const token = await tokenUseCases.authenticate.execute(secret);
		if (!token) {
			return HttpResponses.json({ error: 'Authentication required' }, 401);
		}

		return { id: token.ownerId, kind: 'home_assistant_user' };
	}

	private static bearerSecret(request: Request): string | undefined {
		const authorizationParts = (request.headers.get('authorization') ?? '').trim().split(/\s+/u, 3);
		const [scheme = '', secret = ''] = authorizationParts;

		return secret && authorizationParts.length === 2 && scheme.toLowerCase() === 'bearer' ? secret : undefined;
	}
}

export { FinancialAuthentication };
