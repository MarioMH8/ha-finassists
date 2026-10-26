import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createServer, prepareWebAssets } from '@modules/api';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { createBootstrapCapability, publishSupervisorDiscovery } from '@modules/system-credentials/infrastructure';
import { Database } from 'bun:sqlite';

import { createAppContainer } from './app-container';
import { loadServerConfig } from './config';

async function startApp(): Promise<ReturnType<typeof createServer>> {
	const config = await loadServerConfig();
	await prepareWebAssets(config.developmentMode);
	await mkdir(path.dirname(config.databasePath), { recursive: true });
	const database = new Database(config.databasePath);
	database.run('PRAGMA journal_mode = WAL');
	migrateDatabase(database);
	const container = createAppContainer(database, {
		currencyCode: config.shellConfig.currencyCode,
		timeZone: config.timeZone,
	});
	const bootstrapCapability =
		config.supervisorToken === undefined ? config.bootstrapCapability : createBootstrapCapability();
	const isBootstrapCapabilityConfigured =
		bootstrapCapability !== undefined &&
		container
			.get('systemCredentialRepository')
			.configureBootstrapCapability(
				await container.get('systemCredentialService').hash(bootstrapCapability),
				new Date(Date.now() + 15 * 60 * 1000).toISOString()
			);

	const server = createServer({
		container,
		developmentActor: config.developmentActor,
		developmentMode: config.developmentMode,
		port: config.port,
		shellConfig: config.shellConfig,
		trustedIngressIp: config.trustedIngressIp,
	});

	if (isBootstrapCapabilityConfigured && config.supervisorToken !== undefined) {
		try {
			await publishSupervisorDiscovery(config.supervisorToken, bootstrapCapability);
		} catch {
			await server.stop(true);
			await container.dispose();
			database.close();
			throw new Error('Unable to provision Home Assistant integration discovery; add-on startup aborted');
		}
	}

	return server;
}

export { startApp as startApplication };
