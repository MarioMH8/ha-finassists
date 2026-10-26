import { ScheduledTransactionProjectionRangeInvalidError } from '@modules/ledger/domain';
import { ScheduledTransactionMother } from '@modules/ledger/domain/scheduled-transaction.mother';
import { MockScheduledTransactionRepository } from '@modules/ledger/infrastructure/repositories/mock-scheduled-transaction.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { ListUpcomingScheduledTransactions } from './list-upcoming-scheduled-transactions';

async function failureOf(action: () => Promise<unknown>): Promise<unknown> {
	try {
		await action();
	} catch (error) {
		return error;
	}

	return undefined;
}

describe('ListUpcomingScheduledTransactions', () => {
	let repository: MockScheduledTransactionRepository;
	let useCase: ListUpcomingScheduledTransactions;

	beforeEach(() => {
		repository = new MockScheduledTransactionRepository();
		useCase = new ListUpcomingScheduledTransactions(repository, 'EUR');
	});

	function schedules() {
		return [
			ScheduledTransactionMother.create({
				amountMinor: 1000,
				categoryId: 'cat-food',
				id: 'expense',
				startDate: '2026-05-01',
			}),
			ScheduledTransactionMother.create({
				amountMinor: 2000,
				categoryId: null,
				frequency: 'once',
				id: 'income',
				kind: 'income',
				startDate: '2026-05-15',
			}),
			ScheduledTransactionMother.create({ id: 'paused', startDate: '2026-05-01' }).pause(),
			ScheduledTransactionMother.create({
				currencyCode: 'USD',
				id: 'usd',
				startDate: '2026-05-01',
			}),
		];
	}

	it('projects active schedules in the installation currency and totals them', async () => {
		repository.shouldSearch({ items: schedules(), total: 4 });

		const forecast = await useCase.execute({ fromDate: '2026-05-01', toDate: '2026-07-01' });

		expect(forecast.items.map(item => [item.dueDate, item.kind])).toEqual([
			['2026-05-01', 'expense'],
			['2026-05-15', 'income'],
			['2026-06-01', 'expense'],
			['2026-07-01', 'expense'],
		]);
		expect(forecast).toMatchObject({
			currencyCode: 'EUR',
			total: 4,
			totals: { expenseMinor: 3000, incomeMinor: 2000, netMinor: -1000 },
			uncategorized: { expenseMinor: 0, incomeMinor: 2000 },
		});
		expect(forecast.byCategory).toEqual({
			expense: { 'cat-food': 3000 },
			income: {},
		});
		expect(repository.searchedCriteria[0]).toMatchObject({
			limit: 1000,
			status: 'active',
		});
	});

	it('paginates items while keeping the totals for the whole range', async () => {
		repository.shouldSearch({ items: schedules(), total: 4 });

		const forecast = await useCase.execute({
			fromDate: '2026-05-01',
			limit: 2,
			offset: 1,
			toDate: '2026-07-01',
		});

		expect(forecast.items.map(item => item.dueDate)).toEqual(['2026-05-15', '2026-06-01']);
		expect(forecast.total).toBe(4);
		expect(forecast.totals.expenseMinor).toBe(3000);
	});

	it('filters by kind and category defensively', async () => {
		repository.shouldSearch({ items: schedules(), total: 4 });

		const byKind = await useCase.execute({
			fromDate: '2026-05-01',
			kind: 'income',
			toDate: '2026-07-01',
		});
		const byCategory = await useCase.execute({
			categoryId: 'cat-food',
			fromDate: '2026-05-01',
			toDate: '2026-07-01',
		});

		expect(byKind.items.every(item => item.kind === 'income')).toBe(true);
		expect(byCategory.items.every(item => item.categoryId === 'cat-food')).toBe(true);
	});

	it('rejects invalid ranges and page sizes', async () => {
		expect(await failureOf(() => useCase.execute({ fromDate: '2026-06-01', toDate: '2026-05-01' }))).toBeInstanceOf(
			ScheduledTransactionProjectionRangeInvalidError
		);
		expect(
			await failureOf(() => useCase.execute({ fromDate: '2026-05-01', limit: 0, toDate: '2026-05-31' }))
		).toBeInstanceOf(RangeError);
		expect(
			await failureOf(() => useCase.execute({ fromDate: '2026-05-01', offset: -1, toDate: '2026-05-31' }))
		).toBeInstanceOf(RangeError);
	});
});
