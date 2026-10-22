import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { Database } from 'bun:sqlite';

import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '../modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '../modules/tokens/infrastructure';
import { loadServerConfig } from './config';
import { createServer } from './http/create-server';
import { prepareWebAssets } from './http/web-assets';

const config = await loadServerConfig();
await prepareWebAssets();
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
const server = createServer({ ...config, tokenUseCases });

console.info(`Fin Assist is listening on ${server.url}`);
