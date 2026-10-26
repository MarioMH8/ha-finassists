import { MockScheduledPostingRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-posting.repository';
import type { ScheduledJob, Scheduler } from '@modules/scheduling/application';
import { describe, expect, it, mock, spyOn } from 'bun:test';

import { PostDueScheduledTransactions } from './post-due-scheduled-transactions';
import { SCHEDULED_POSTING_CRON, ScheduledPostingJob } from './scheduled-posting-job';

const NOW = '2026-05-01T10:00:00.000Z';

class FakeScheduler implements Scheduler {
	expression: string | undefined;
	readonly handle: ScheduledJob = {
		stop: () => {
			this.stopCalls += 1;
		},
	};

	stopCalls = 0;
	task: (() => Promise<void>) | undefined;

	schedule(expression: string, task: () => Promise<void>): ScheduledJob {
		this.expression = expression;
		this.task = task;

		return this.handle;
	}
}

function setup() {
	const repository = new MockScheduledPostingRepository();
	const useCase = new PostDueScheduledTransactions(
		repository,
		() => '2026-05-01',
		() => NOW
	);
	const execute = spyOn(useCase, 'execute').mockResolvedValue({ posted: 0, schedules: 0 });
	const scheduler = new FakeScheduler();
	const logger = mock(() => {
		// The test asserts the call.
	});
	const job = new ScheduledPostingJob(useCase, scheduler, logger);

	return { execute, job, logger, scheduler };
}

describe('ScheduledPostingJob', () => {
	it('runs immediately and schedules the posting cron', async () => {
		const { execute, job, scheduler } = setup();

		const handle = job.start();
		await Promise.resolve();

		expect(execute).toHaveBeenCalledTimes(1);
		expect(scheduler.expression).toBe(SCHEDULED_POSTING_CRON);
		expect(handle).toBe(scheduler.handle);
	});

	it('is idempotent and exposes the scheduler task', async () => {
		const { execute, job, scheduler } = setup();

		const first = job.start();
		const second = job.start();
		await Promise.resolve();
		await scheduler.task?.();

		expect(first).toBe(second);
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it('does not overlap two runs', async () => {
		const { execute, job } = setup();
		const { promise: execution, resolve: resolveExecution } = Promise.withResolvers<{
			posted: number;
			schedules: number;
		}>();
		execute.mockReturnValue(execution);

		const first = job.runOnce();
		const second = job.runOnce();

		expect(execute).toHaveBeenCalledTimes(1);
		resolveExecution({ posted: 0, schedules: 0 });
		await Promise.all([first, second]);
	});

	it('logs failures and stays usable', async () => {
		const { execute, job, logger } = setup();
		const error = new Error('boom');
		execute.mockRejectedValueOnce(error);

		await job.runOnce();
		await job.runOnce();

		expect(logger).toHaveBeenCalledWith(error);
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it('stops the scheduler handle', async () => {
		const { job, scheduler } = setup();
		job.start();
		await Promise.resolve();

		job.stop();

		expect(scheduler.stopCalls).toBe(1);
	});

	it('accepts a custom cron expression', () => {
		const repository = new MockScheduledPostingRepository();
		const useCase = new PostDueScheduledTransactions(
			repository,
			() => '2026-05-01',
			() => NOW
		);
		const scheduler = new FakeScheduler();
		const job = new ScheduledPostingJob(
			useCase,
			scheduler,
			() => {
				// The custom expression test does not assert logging.
			},
			'5 0 * * *'
		);

		job.start();

		expect(scheduler.expression).toBe('5 0 * * *');
	});
});
