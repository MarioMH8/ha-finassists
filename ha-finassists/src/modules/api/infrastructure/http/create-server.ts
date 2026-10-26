import type { HomeAssistantActor } from '@modules/home-assistant';
import type { ShellConfig } from '@modules/shell/domain';

import type { HttpContainer } from './routes';
// eslint-disable-next-line unicorn/name-replacements -- The adapter keeps its full domain name.
import { HttpApplication } from './routes';

class ApiServer {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create({
		container,
		developmentActor,
		developmentMode,
		port,
		shellConfig,
		trustedIngressIp,
	}: ServerOptions): ReturnType<typeof Bun.serve> {
		const app = HttpApplication.create(container);
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
}

export interface ServerOptions {
	container: HttpContainer;
	developmentActor?: HomeAssistantActor | undefined;
	developmentMode?: boolean | undefined;
	port: number;
	shellConfig?: ShellConfig | undefined;
	trustedIngressIp: string;
}

export { ApiServer };
