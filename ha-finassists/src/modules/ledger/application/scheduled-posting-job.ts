import type { ScheduledJob, Scheduler } from '@modules/scheduling/application';

import type { PostDueScheduledTransactions } from './post-due-scheduled-transactions';

const SCHEDULED_POSTING_CRON = '*/15 * * * *';

type ScheduledPostingJobLogger = (error: unknown) => void;

class ScheduledPostingJob {
	private isRunning = false;
	private job: ScheduledJob | undefined;

	constructor(
		private readonly postDue: PostDueScheduledTransactions,
		private readonly scheduler: Scheduler,
		private readonly logger: ScheduledPostingJobLogger,
		private readonly cron = SCHEDULED_POSTING_CRON
	) {}

	async runOnce(): Promise<void> {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;
		try {
			await this.postDue.execute();
		} catch (error) {
			this.logger(error);
		} finally {
			// The guard is process-local; the job never runs concurrently inside this process.
			this.isRunning = false;
		}
	}

	start(): ScheduledJob {
		if (this.job) {
			return this.job;
		}
		void this.runOnce();
		this.job = this.scheduler.schedule(this.cron, () => this.runOnce());

		return this.job;
	}

	stop(): void {
		this.job?.stop();
		this.job = undefined;
	}
}

export { SCHEDULED_POSTING_CRON, ScheduledPostingJob, type ScheduledPostingJobLogger };
