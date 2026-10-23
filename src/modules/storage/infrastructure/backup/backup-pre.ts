import { Database } from 'bun:sqlite';

interface CheckpointResult {
	busy: number;
	checkpointed: number;
	log: number;
}

function checkpointDatabase(database: Database): void {
	database.run('PRAGMA busy_timeout = 5000');
	const checkpoint = database.query('PRAGMA wal_checkpoint(TRUNCATE)').get() as CheckpointResult | null;
	if (checkpoint?.busy !== 0) {
		throw new Error('SQLite WAL checkpoint could not complete before backup');
	}
}

async function prepareBackup(): Promise<void> {
	const databasePath = Bun.env.DATABASE_PATH ?? '/data/fin-assist.sqlite';
	if (!(await Bun.file(databasePath).exists())) {
		return;
	}

	const database = new Database(databasePath);
	try {
		checkpointDatabase(database);
	} finally {
		database.close();
	}
}

if (import.meta.main) {
	await prepareBackup();
}

export { checkpointDatabase, prepareBackup };
