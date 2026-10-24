import type {
	AccountTransactionTotalsCriteria,
	AccountTransactionTotalsQuery,
	TransactionTotals,
} from '@modules/accounts/domain';
import { expect, mock } from 'bun:test';

export class MockAccountTransactionTotalsQuery implements AccountTransactionTotalsQuery {
	private readonly sumByStatusMock = mock<AccountTransactionTotalsQuery['sumByStatus']>(() => ({
		cleared: 0,
		reconciled: 0,
		uncleared: 0,
	}));

	assertSumByStatusHasBeenCalledWith(criteria: AccountTransactionTotalsCriteria): void {
		expect(this.sumByStatusMock).toHaveBeenCalledWith(criteria);
	}

	assertSumByStatusHasNotBeenCalled(): void {
		expect(this.sumByStatusMock).not.toHaveBeenCalled();
	}

	shouldSum(totals: TransactionTotals): void {
		this.sumByStatusMock.mockReturnValue(totals);
	}

	sumByStatus(criteria: AccountTransactionTotalsCriteria): TransactionTotals {
		return this.sumByStatusMock(criteria);
	}
}
