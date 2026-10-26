interface ScheduledJob {
	stop(): void;
}

interface Scheduler {
	schedule(expression: string, task: () => Promise<void>): ScheduledJob;
}

export type { ScheduledJob, Scheduler };
