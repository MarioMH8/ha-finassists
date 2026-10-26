import type { ScheduledJob, Scheduler } from '@modules/scheduling/application';

interface CronJobHandle {
	stop(): unknown;
	unref(): unknown;
}

type CronRegistrar = (expression: string, task: () => Promise<void>, options: { tz: string }) => CronJobHandle;

export class BunCronScheduler implements Scheduler {
	constructor(
		private readonly timeZone: string,
		private readonly register: CronRegistrar = (expression, task, options) => Bun.cron(expression, task, options)
	) {}

	schedule(expression: string, task: () => Promise<void>): ScheduledJob {
		const job = this.register(expression, task, { tz: this.timeZone });
		job.unref();

		return {
			stop: () => {
				job.stop();
			},
		};
	}
}
