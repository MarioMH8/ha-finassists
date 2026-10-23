import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createServer, prepareWebAssets } from '@modules/api';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';

import { loadServerConfig } from './config';

async function startApp(): Promise<ReturnType<typeof createServer>> {
	const config = await loadServerConfig();
	await prepareWebAssets(config.developmentMode);
	await mkdir(path.dirname(config.databasePath), { recursive: true });
	const database = new Database(config.databasePath);
	const tokenRepository = new SqliteApiTokenRepository(database);
	const tokenCredentialService = new WebCryptoTokenCredentialService();
	const tokenUseCases = {
		authenticate: new AuthenticateApiToken(tokenRepository, tokenCredentialService),
		issue: new IssueApiToken(tokenRepository, tokenCredentialService),
		list: new ListApiTokens(tokenRepository),
		revoke: new RevokeApiToken(tokenRepository),
	};

	return createServer({
		developmentActor: config.developmentActor,
		developmentMode: config.developmentMode,
		port: config.port,
		tokenUseCases,
		trustedIngressIp: config.trustedIngressIp,
	});
}

export { startApp as startApplication };
