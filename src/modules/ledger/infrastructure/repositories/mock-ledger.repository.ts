import type {
	CreateTransactionInput,
	CreateTransferInput,
	FinancialTransaction,
	LedgerRepository,
	TransactionStatus,
	UpdateTransactionInput,
} from '@modules/ledger/domain';
import { expect, mock } from 'bun:test';

type Transfer = ReturnType<LedgerRepository['createTransfer']>;

export class MockLedgerRepository implements LedgerRepository {
	private readonly createMock = mock<LedgerRepository['create']>();
	private readonly createTransferMock = mock<LedgerRepository['createTransfer']>();
	private readonly findMock = mock<LedgerRepository['find']>();
	private readonly listMock = mock<LedgerRepository['list']>(() => []);
	private readonly removeMock = mock<LedgerRepository['remove']>(() => false);
	private readonly setStatusMock = mock<LedgerRepository['setStatus']>(() => false);
	private readonly updateMock = mock<LedgerRepository['update']>();

	assertCreateHasBeenCalledWith(input: CreateTransactionInput): void {
		expect(this.createMock).toHaveBeenCalledWith(input);
	}

	assertCreateHasNotBeenCalled(): void {
		expect(this.createMock).not.toHaveBeenCalled();
	}

	assertCreateTransferHasBeenCalledWith(input: CreateTransferInput): void {
		expect(this.createTransferMock).toHaveBeenCalledWith(input);
	}

	assertCreateTransferHasNotBeenCalled(): void {
		expect(this.createTransferMock).not.toHaveBeenCalled();
	}

	assertFindHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.findMock).toHaveBeenCalledWith(bookId, id);
	}

	assertListHasBeenCalledWith(bookId: string, accountId: string): void {
		expect(this.listMock).toHaveBeenCalledWith(bookId, accountId);
	}

	assertRemoveHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.removeMock).toHaveBeenCalledWith(bookId, id);
	}

	assertRemoveHasNotBeenCalled(): void {
		expect(this.removeMock).not.toHaveBeenCalled();
	}

	assertSetStatusHasBeenCalledWith(bookId: string, id: string, status: TransactionStatus): void {
		expect(this.setStatusMock).toHaveBeenCalledWith(bookId, id, status);
	}

	assertSetStatusHasNotBeenCalled(): void {
		expect(this.setStatusMock).not.toHaveBeenCalled();
	}

	assertUpdateHasBeenCalledWith(bookId: string, id: string, input: UpdateTransactionInput): void {
		expect(this.updateMock).toHaveBeenCalledWith(bookId, id, input);
	}

	assertUpdateHasNotBeenCalled(): void {
		expect(this.updateMock).not.toHaveBeenCalled();
	}

	create(input: CreateTransactionInput): FinancialTransaction {
		return this.createMock(input);
	}

	createTransfer(input: CreateTransferInput): Transfer {
		return this.createTransferMock(input);
	}

	find(bookId: string, id: string): FinancialTransaction | undefined {
		return this.findMock(bookId, id);
	}

	list(bookId: string, accountId: string): FinancialTransaction[] {
		return this.listMock(bookId, accountId);
	}

	remove(bookId: string, id: string): boolean {
		return this.removeMock(bookId, id);
	}

	setStatus(bookId: string, id: string, status: TransactionStatus): boolean {
		return this.setStatusMock(bookId, id, status);
	}

	shouldCreate(transaction: FinancialTransaction): void {
		this.createMock.mockReturnValue(transaction);
	}

	shouldCreateTransfer(transfer: Transfer): void {
		this.createTransferMock.mockReturnValue(transfer);
	}

	shouldFind(transaction: FinancialTransaction | undefined): void {
		this.findMock.mockReturnValue(transaction);
	}

	shouldList(transactions: FinancialTransaction[]): void {
		this.listMock.mockReturnValue(transactions);
	}

	shouldRemove(isRemoved: boolean): void {
		this.removeMock.mockReturnValue(isRemoved);
	}

	shouldSetStatus(isUpdated: boolean): void {
		this.setStatusMock.mockReturnValue(isUpdated);
	}

	shouldUpdate(transaction: FinancialTransaction | undefined): void {
		this.updateMock.mockReturnValue(transaction);
	}

	update(bookId: string, id: string, input: UpdateTransactionInput): FinancialTransaction | undefined {
		return this.updateMock(bookId, id, input);
	}
}
