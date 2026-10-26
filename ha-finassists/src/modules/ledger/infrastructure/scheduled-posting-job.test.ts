import { describe, expect, it, mock } from 'bun:test';

import { startScheduledPostingJob } from './scheduled-posting-job';

describe('startScheduledPostingJob', () => {
	it('runs immediately, logs failures and can be stopped', async () => {
		const error = new Error('boom');
		const run = mock(() => Promise.reject(error));
		const logger = mock(() => {
			// The test only asserts that the failure is reported.
		});

		const stop = startScheduledPostingJob({ intervalMs: 60_000, logger, run });
		await new Promise<void>(resolve => {
			setTimeout(resolve, 0);
		});
		stop();

		expect(run).toHaveBeenCalledTimes(1);
		expect(logger).toHaveBeenCalledWith(error);
	});
});
