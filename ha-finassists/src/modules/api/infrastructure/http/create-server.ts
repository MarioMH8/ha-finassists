import type { HomeAssistantActor } from '@modules/home-assistant';
import type { ShellConfig } from '@modules/shell/domain';

import type { HttpContainer } from './routes';
import { createHttpApp } from './routes';

export interface ServerOptions {
	container: HttpContainer;
	developmentActor?: HomeAssistantActor | undefined;
	developmentMode?: boolean | undefined;
	port: number;
	shellConfig?: ShellConfig | undefined;
	trustedIngressIp: string;
}

export function createServer({
	container,
	developmentActor,
	developmentMode,
	port,
	shellConfig,
	trustedIngressIp,
}: ServerOptions): ReturnType<typeof Bun.serve> {
	const app = createHttpApp(container);
	const server = Bun.serve({
		async fetch(request, server) {
			return app.fetch(request, {
				requestContext: {
					developmentActor,
					developmentMode,
					remoteAddress: server.requestIP(request)?.address,
					shellConfig,
					trustedIngressIp,
				},
			});
		},
		maxRequestBodySize: 6 * 1024 * 1024,
		port,
	});

	return server;
}
