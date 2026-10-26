const DEFAULT_SCHEDULED_POSTING_INTERVAL_MS = 15 * 60 * 1000;

interface ScheduledPostingJobOptions {
	intervalMs?: number;
	logger?: (error: unknown) => void;
	run: () => Promise<unknown>;
}

function startScheduledPostingJob({
	intervalMs = DEFAULT_SCHEDULED_POSTING_INTERVAL_MS,
	logger = () => {
		// Failures are ignored when no logger is configured.
	},
	run,
}: ScheduledPostingJobOptions): () => void {
	let isRunning = false;
	const tick = async (): Promise<void> => {
		if (isRunning) {
			return;
		}
		isRunning = true;
		try {
			await run();
		} catch (error) {
			logger(error);
		} finally {
			// The guard is process-local; the job never runs concurrently inside this process.
			// eslint-disable-next-line require-atomic-updates
			isRunning = false;
		}
	};
	void tick();
	const timer = setInterval(() => {
		void tick();
	}, intervalMs);
	timer.unref();

	return () => {
		clearInterval(timer);
	};
}

export { DEFAULT_SCHEDULED_POSTING_INTERVAL_MS, startScheduledPostingJob };
