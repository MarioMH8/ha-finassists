import type { TokenManagementUseCases } from './routes';
import { handleRequest } from './routes';

export interface ServerOptions {
	port: number;
	tokenUseCases: TokenManagementUseCases;
	trustedIngressIp: string;
}

export function createServer({ port, tokenUseCases, trustedIngressIp }: ServerOptions): ReturnType<typeof Bun.serve> {
	const server = Bun.serve({
		async fetch(request, server) {
			return handleRequest(
				request,
				{
					remoteAddress: server.requestIP(request)?.address,
					trustedIngressIp,
				},
				tokenUseCases
			);
		},
		port,
	});

	return server;
}
