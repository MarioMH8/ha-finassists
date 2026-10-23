import type { LedgerRepository, UpdateTransactionInput } from '../domain';
import { validateTransactionInput } from '../domain';

const JSON_NULL = JSON.parse('null') as null;

class UpdateTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(bookId: string, id: string, input: UpdateTransactionInput): ReturnType<LedgerRepository['update']> {
		const existing = this.repository.find(bookId, id);
		if (!existing) {
			return;
		}

		if (existing.status === 'reconciled' && this.changesBalanceAffectingFields(existing, input)) {
			throw new Error(
				'Reconciled transactions must be unreconciled before changing their date, account, amount, or splits'
			);
		}
		if (existing.transferId !== null && (input.accountId !== undefined || input.parts !== undefined)) {
			throw new Error('Transfer accounts and splits cannot be changed independently');
		}
		if (existing.transferId !== null && input.amountMinor !== undefined && input.amountMinor === 0) {
			throw new Error('Transfer amount must be greater than zero');
		}
		if (input.payee !== undefined && input.payee.length > 120) {
			throw new Error('Payee must be at most 120 characters');
		}
		if (input.memo !== undefined && input.memo.length > 500) {
			throw new Error('Memo must be at most 500 characters');
		}

		let parts = input.parts;
		if (parts === undefined && input.amountMinor !== undefined && existing.parts.length > 1) {
			throw new Error('Split transaction amount changes require a complete replacement of its parts');
		}
		if (parts === undefined && input.amountMinor !== undefined && existing.parts.length === 1) {
			parts = [{ ...existing.parts[0], amountMinor: input.amountMinor }];
		}

		validateTransactionInput({
			accountId: input.accountId ?? existing.accountId,
			actorId: existing.actorId,
			amountMinor: input.amountMinor ?? existing.amountMinor,
			bookId,
			memo: input.memo ?? existing.memo,
			parts: parts ?? existing.parts,
			payee: input.payee ?? existing.payee,
			transactionDate: input.transactionDate ?? existing.transactionDate,
		});

		return this.repository.update(bookId, id, { ...input, parts });
	}

	private changesBalanceAffectingFields(
		existing: object & ReturnType<LedgerRepository['find']>,
		input: UpdateTransactionInput
	): boolean {
		return (
			(input.accountId !== undefined && input.accountId !== existing.accountId) ||
			(input.amountMinor !== undefined && input.amountMinor !== existing.amountMinor) ||
			(input.transactionDate !== undefined && input.transactionDate !== existing.transactionDate) ||
			(input.parts !== undefined &&
				(input.parts.length !== existing.parts.length ||
					input.parts.some((part, index) => {
						const current = existing.parts[index];

						return (
							part.amountMinor !== current.amountMinor ||
							(part.categoryId ?? JSON_NULL) !== current.categoryId ||
							(part.classId ?? JSON_NULL) !== current.classId ||
							(part.memo ?? '') !== current.memo
						);
					})))
		);
	}
}

export { UpdateTransaction };
