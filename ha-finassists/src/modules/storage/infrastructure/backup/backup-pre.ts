import { Database } from 'bun:sqlite';

interface CheckpointResult {
	busy: number;
	checkpointed: number;
	log: number;
}

class DatabaseBackup {
	private constructor() {}

	static checkpoint(database: Database): void {
		database.run('PRAGMA busy_timeout = 5000');
		const checkpoint = database.query('PRAGMA wal_checkpoint(TRUNCATE)').get() as CheckpointResult | null;
		if (checkpoint?.busy !== 0) {
			throw new Error('SQLite WAL checkpoint could not complete before backup');
		}
	}

	static async prepare(): Promise<void> {
		const databasePath = Bun.env.DATABASE_PATH ?? '/data/fin-assist.sqlite';
		if (!(await Bun.file(databasePath).exists())) {
			return;
		}

		const database = new Database(databasePath);
		try {
			this.checkpoint(database);
		} finally {
			database.close();
		}
	}
}

if (import.meta.main) {
	await DatabaseBackup.prepare();
}

export { DatabaseBackup };
