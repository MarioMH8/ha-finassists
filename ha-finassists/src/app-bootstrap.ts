import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { ApiServer, WebAssets } from '@modules/api';
import { ScheduledPostingJob } from '@modules/ledger/application';
import { BunCronScheduler } from '@modules/scheduling/infrastructure';
import { DatabaseMigrator } from '@modules/storage/infrastructure';
import { BootstrapCapability, SupervisorDiscovery } from '@modules/system-credentials/infrastructure';
import { Database } from 'bun:sqlite';

import { createAppContainer } from './app-container';
import { ServerConfigLoader } from './config';

async function startApp(): Promise<ReturnType<typeof ApiServer.create>> {
	const config = await ServerConfigLoader.load();
	await WebAssets.prepare(config.developmentMode);
	await mkdir(path.dirname(config.databasePath), { recursive: true });
	const database = new Database(config.databasePath);
	database.run('PRAGMA journal_mode = WAL');
	DatabaseMigrator.migrate(database);
	const container = createAppContainer(database, {
		currencyCode: config.shellConfig.currencyCode,
		timeZone: config.timeZone,
	});
	const bootstrapCapability =
		config.supervisorToken === undefined ? config.bootstrapCapability : BootstrapCapability.create();
	const isBootstrapCapabilityConfigured =
		bootstrapCapability !== undefined &&
		container
			.get('systemCredentialRepository')
			.configureBootstrapCapability(
				await container.get('systemCredentialService').hash(bootstrapCapability),
				new Date(Date.now() + 15 * 60 * 1000).toISOString()
			);

	const server = ApiServer.create({
		container,
		developmentActor: config.developmentActor,
		developmentMode: config.developmentMode,
		port: config.port,
		shellConfig: config.shellConfig,
		trustedIngressIp: config.trustedIngressIp,
	});

	if (isBootstrapCapabilityConfigured && config.supervisorToken !== undefined) {
		try {
			await SupervisorDiscovery.publish(config.supervisorToken, bootstrapCapability);
		} catch {
			await server.stop(true);
			await container.dispose();
			database.close();
			throw new Error('Unable to provision Home Assistant integration discovery; add-on startup aborted');
		}
	}

	const scheduledPostingJob = new ScheduledPostingJob(
		container.get('ledgerUseCases').scheduled.postDue,
		new BunCronScheduler(config.timeZone),
		error => {
			process.stderr.write(`Scheduled posting failed: ${String(error)}\n`);
		}
	);
	scheduledPostingJob.start();

	return server;
}

export { startApp as startApplication };
