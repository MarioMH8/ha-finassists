import { handleRequest } from './routes';

export interface ServerOptions {
	port: number;
	trustedIngressIp: string;
}

export function createServer({ port, trustedIngressIp }: ServerOptions): ReturnType<typeof Bun.serve> {
	const server = Bun.serve({
		fetch(request, server) {
			return handleRequest(request, {
				remoteAddress: server.requestIP(request)?.address,
				trustedIngressIp,
			});
		},
		port,
	});

	return server;
}
