import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import type { ConfirmActionProps } from '@modules/accounts/presentation/accounts-panel';
import type { ReactElement, SubmitEvent } from 'react';

interface AccountOptionView {
	closedAt: null | string;
	id: string;
	name: string;
}

interface ClassificationOptionView {
	archivedAt: null | string;
	id: string;
	name: string;
}

interface TransactionPartView {
	amountMinor: number;
	categoryId: null | string;
	classId: null | string;
	id: string;
	memo: string;
}

interface FinancialTransactionView {
	accountId: string;
	amountMinor: number;
	id: string;
	memo: string;
	parts: TransactionPartView[];
	payee: string;
	status: string;
	transactionDate: string;
	transferId: null | string;
}

interface TransactionsPanelProps {
	ConfirmAction: (props: ConfirmActionProps) => ReactElement;
	accountId: string;
	accounts: AccountOptionView[];
	busy: boolean;
	categories: ClassificationOptionView[];
	classes: ClassificationOptionView[];
	copy: Copy;
	editingTransaction: FinancialTransactionView | undefined;
	formatDate: (value: string, language: Language) => string;
	formatMoney: (value: number) => string;
	language: Language;
	loadingTransactions: boolean;
	localized: (key: keyof Copy, fallback: string) => string;
	minorUnitsToInput: (value: number, currency: string) => string;
	onAccountChange: (id: string) => void;
	onCancelEdit: () => void;
	onDeleteTransaction: (transaction: FinancialTransactionView) => void;
	onEditTransaction: (transaction: FinancialTransactionView) => void;
	onSetStatus: (transaction: FinancialTransactionView, status: string) => void;
	onSubmitTransaction: (event: SubmitEvent<HTMLFormElement>) => void;
	onSubmitTransfer: (event: SubmitEvent<HTMLFormElement>) => void;
	selectedBookCurrency: string;
	styles: Record<string, string>;
	transactions: FinancialTransactionView[];
}

function TransactionsPanel({
	accountId,
	accounts,
	busy,
	categories,
	classes,
	ConfirmAction,
	copy,
	editingTransaction,
	formatDate,
	formatMoney,
	language,
	loadingTransactions,
	localized,
	minorUnitsToInput,
	onAccountChange,
	onCancelEdit,
	onDeleteTransaction,
	onEditTransaction,
	onSetStatus,
	onSubmitTransaction,
	onSubmitTransfer,
	selectedBookCurrency,
	styles,
	transactions,
}: TransactionsPanelProps): ReactElement {
	const openAccounts = accounts.filter(item => !item.closedAt);

	return (
		<section className={styles.card}>
			<div className={styles['section-title']}>
				<div>
					<h3>{copy.financeTransactions}</h3>
					<p>{copy.financeTransactionsHelp}</p>
				</div>
				<label className={styles['book-select']}>
					{copy.financeAccount}
					<select
						aria-label={copy.financeAccount}
						onChange={event => onAccountChange(event.currentTarget.value)}
						value={accountId}>
						{accounts.map(account => (
							<option
								disabled={Boolean(account.closedAt)}
								key={account.id}
								value={account.id}>
								{account.name}
							</option>
						))}
					</select>
				</label>
			</div>
			{loadingTransactions ? (
				<p role='status'>{copy.financeLoading}</p>
			) : transactions.length > 0 ? (
				<div className={styles['table-wrap']}>
					<table>
						<thead>
							<tr>
								<th>{copy.financeDate}</th>
								<th>{copy.financePayee}</th>
								<th>{copy.financeAmount}</th>
								<th>{copy.financeStatus}</th>
								<th>{copy.financeActions}</th>
							</tr>
						</thead>
						<tbody>
							{transactions.map(transaction => (
								<tr key={transaction.id}>
									<td>{formatDate(transaction.transactionDate, language)}</td>
									<td>{transaction.payee || transaction.memo || '—'}</td>
									<td className={transaction.amountMinor < 0 ? styles.negative : styles.positive}>
										{formatMoney(transaction.amountMinor)}
									</td>
									<td>
										{localized(
											`financeStatus_${transaction.status}` as keyof Copy,
											transaction.status
										)}
									</td>
									<td>
										<div className={styles['row-actions']}>
											<button
												className={styles.secondary}
												disabled={
													busy ||
													transaction.status === 'reconciled' ||
													Boolean(transaction.transferId)
												}
												onClick={() => onEditTransaction(transaction)}
												type='button'>
												{copy.financeEdit}
											</button>
											<select
												aria-label={`${copy.financeStatus} ${transaction.payee}`}
												disabled={busy}
												onChange={event => {
													const status = event.currentTarget.value;
													if (status) {
														onSetStatus(transaction, status);
													}
												}}
												value=''>
												<option value=''>{copy.financeSetStatus}</option>
												{(['uncleared', 'cleared', 'reconciled'] as const)
													.filter(status => status !== transaction.status)
													.map(status => (
														<option
															key={status}
															value={status}>
															{localized(`financeStatus_${status}` as keyof Copy, status)}
														</option>
													))}
											</select>
											<ConfirmAction
												cancelLabel={copy.cancel}
												className={styles.secondary}
												disabled={busy}
												label={copy.financeDelete}
												onConfirm={() => onDeleteTransaction(transaction)}
												prompt={copy.financeConfirmDelete}
											/>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className={styles.empty}>{copy.financeNoTransactions}</p>
			)}
			<form
				className={styles['stack-form']}
				key={editingTransaction?.id ?? 'new'}
				onSubmit={onSubmitTransaction}>
				<h4>{editingTransaction ? copy.financeEditTransaction : copy.financeNewTransaction}</h4>
				<div className={styles['form-grid']}>
					<label>
						{copy.financeDate}
						<input
							defaultValue={editingTransaction?.transactionDate ?? ''}
							name='transactionDate'
							required
							type='date'
						/>
					</label>
					<label>
						{copy.financePayee}
						<input
							autoComplete='off'
							defaultValue={editingTransaction?.payee ?? ''}
							maxLength={120}
							name='payee'
						/>
					</label>
					<label>
						{copy.financeAmount}
						<input
							defaultValue={
								editingTransaction
									? minorUnitsToInput(editingTransaction.amountMinor, selectedBookCurrency)
									: ''
							}
							inputMode='decimal'
							name='amount'
							required
							step='any'
							type='number'
						/>
					</label>
					<label>
						{copy.financeCategory}
						<select
							defaultValue={editingTransaction?.parts[0]?.categoryId ?? ''}
							name='categoryId'>
							<option value=''>{copy.financeNoCategory}</option>
							{categories
								.filter(item => !item.archivedAt)
								.map(item => (
									<option
										key={item.id}
										value={item.id}>
										{item.name}
									</option>
								))}
						</select>
					</label>
					<label>
						{copy.financeClass}
						<select
							defaultValue={editingTransaction?.parts[0]?.classId ?? ''}
							name='classId'>
							<option value=''>{copy.financeNoClass}</option>
							{classes
								.filter(item => !item.archivedAt)
								.map(item => (
									<option
										key={item.id}
										value={item.id}>
										{item.name}
									</option>
								))}
						</select>
					</label>
					<label>
						{copy.financeMemo}
						<input
							defaultValue={editingTransaction?.memo ?? ''}
							maxLength={500}
							name='memo'
						/>
					</label>
				</div>
				<div className={styles['row-actions']}>
					<button
						disabled={busy || !accountId}
						type='submit'>
						{editingTransaction ? copy.financeSave : copy.financeCreateTransaction}
					</button>
					{editingTransaction && (
						<button
							className={styles.secondary}
							onClick={onCancelEdit}
							type='button'>
							{copy.cancel}
						</button>
					)}
				</div>
			</form>
			<form
				className={styles['stack-form']}
				onSubmit={onSubmitTransfer}>
				<h4>{copy.financeNewTransfer}</h4>
				<div className={styles['form-grid']}>
					<label>
						{copy.financeFromAccount}
						<select name='fromAccountId'>
							{openAccounts.map(item => (
								<option
									key={item.id}
									value={item.id}>
									{item.name}
								</option>
							))}
						</select>
					</label>
					<label>
						{copy.financeToAccount}
						<select name='toAccountId'>
							{openAccounts.map(item => (
								<option
									key={item.id}
									value={item.id}>
									{item.name}
								</option>
							))}
						</select>
					</label>
					<label>
						{copy.financeAmount}
						<input
							inputMode='decimal'
							name='amount'
							required
							step='any'
							type='number'
						/>
					</label>
					<label>
						{copy.financeDate}
						<input
							name='transactionDate'
							required
							type='date'
						/>
					</label>
					<label>
						{copy.financeMemo}
						<input
							maxLength={500}
							name='memo'
						/>
					</label>
				</div>
				<button
					disabled={busy || openAccounts.length < 2}
					type='submit'>
					{copy.financeCreateTransfer}
				</button>
			</form>
		</section>
	);
}

export { type FinancialTransactionView, type TransactionPartView, TransactionsPanel };
