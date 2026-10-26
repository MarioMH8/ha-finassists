import { describe, expect, it, mock } from 'bun:test';

import { BunCronScheduler } from './bun-cron-scheduler';

describe('BunCronScheduler', () => {
	it('registers the task with the Home Assistant time zone and unrefs it', () => {
		const job = {
			stop: mock(() => {
				// The test asserts the call.
			}),
			unref: mock(() => {
				// The test asserts the call.
			}),
		};
		const register = mock((_expression: string, _task: () => Promise<void>, _options: { tz: string }) => job);
		const scheduler = new BunCronScheduler('Europe/Madrid', register);
		const task = (): Promise<void> => Promise.resolve();

		const scheduled = scheduler.schedule('*/15 * * * *', task);

		expect(register).toHaveBeenCalledWith('*/15 * * * *', task, { tz: 'Europe/Madrid' });
		expect(job.unref).toHaveBeenCalledTimes(1);

		scheduled.stop();

		expect(job.stop).toHaveBeenCalledTimes(1);
	});
});
