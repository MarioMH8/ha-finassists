import type { Language } from '@app/i18n/language';
import type { AccountBalanceView, AccountView } from '@modules/accounts/presentation';
import type { FinancialTransactionView } from '@modules/ledger/presentation';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import styles from './summary-dashboard.module.css';

interface Book {
	archivedAt: null | string;
	currencyCode: string;
	id: string;
	isDefault: boolean;
	name: string;
}

interface SummaryDashboardProps {
	language: Language;
	onAddExpense: () => void;
}

const COPY = {
	en: {
		account: 'Account',
		accounts: 'Accounts',
		addExpense: 'Add an expense',
		balance: 'Balance',
		book: 'Book',
		emptyAccounts: 'Add an account to see your balances here.',
		emptyTransactions: 'No transactions yet for this account.',
		loadError: 'The financial summary could not be loaded.',
		loading: 'Loading your summary…',
		recent: 'Recent transactions',
		title: 'Summary',
		transactionAccount: 'Activity for',
	},
	es: {
		account: 'Cuenta',
		accounts: 'Cuentas',
		addExpense: 'Añadir un gasto',
		balance: 'Saldo',
		book: 'Libro',
		emptyAccounts: 'Añade una cuenta para ver aquí tus saldos.',
		emptyTransactions: 'Todavía no hay movimientos en esta cuenta.',
		loadError: 'No se pudo cargar el resumen financiero.',
		loading: 'Cargando el resumen…',
		recent: 'Movimientos recientes',
		title: 'Resumen',
		transactionAccount: 'Actividad de',
	},
} as const;

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
	const response = await fetch(path, { signal });
	if (!response.ok) {
		throw new Error(`HTTP ${String(response.status)}`);
	}

	return (await response.json()) as T;
}

function pageItems<T>(value: unknown): T[] {
	if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) {
		throw new TypeError('The server returned an invalid list.');
	}

	return value.items as T[];
}

function formatMoney(value: number, currencyCode: string, language: Language): string {
	const fractionDigits =
		new Intl.NumberFormat(language, {
			currency: currencyCode,
			style: 'currency',
		}).resolvedOptions().maximumFractionDigits ?? 2;

	return new Intl.NumberFormat(language, {
		currency: currencyCode,
		maximumFractionDigits: fractionDigits,
		minimumFractionDigits: fractionDigits,
		style: 'currency',
	}).format(value / 10 ** fractionDigits);
}

function SummaryDashboard({ language, onAddExpense }: SummaryDashboardProps): ReactElement {
	const copy = COPY[language];
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [accounts, setAccounts] = useState<AccountView[]>([]);
	const [balances, setBalances] = useState<Partial<Record<string, AccountBalanceView>>>({});
	const [accountId, setAccountId] = useState('');
	const [transactions, setTransactions] = useState<FinancialTransactionView[]>([]);
	const [loadingBooks, setLoadingBooks] = useState(true);
	const [loadingBook, setLoadingBook] = useState(false);
	const [loadingTransactions, setLoadingTransactions] = useState(false);
	const [error, setError] = useState('');
	const selectedBook = books.find(book => book.id === bookId);
	const activeAccounts = accounts.filter(account => !account.closedAt);
	const selectedAccount = accounts.find(account => account.id === accountId);

	useEffect(() => {
		const controller = new AbortController();
		setLoadingBooks(true);
		setError('');
		void request<unknown>('/api/v1/books', controller.signal)
			.then(response => {
				const availableBooks = pageItems<Book>(response).filter(book => !book.archivedAt);
				setBooks(availableBooks);
				setBookId(current =>
					availableBooks.some(book => book.id === current)
						? current
						: (availableBooks.find(book => book.isDefault)?.id ?? availableBooks.at(0)?.id ?? '')
				);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(copy.loadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingBooks(false);
				}
			});

		return () => controller.abort();
	}, [copy.loadError]);

	useEffect(() => {
		if (!bookId) {
			setAccounts([]);
			setBalances({});
			setAccountId('');
			setTransactions([]);

			return;
		}
		const controller = new AbortController();
		setLoadingBook(true);
		setError('');
		setAccounts([]);
		setBalances({});
		setAccountId('');
		setTransactions([]);
		const path = `/api/v1/books/${encodeURIComponent(bookId)}`;
		void request<unknown>(`${path}/accounts`, controller.signal)
			.then(async response => {
				const accountItems = pageItems<AccountView>(response);
				const balancePairs = await Promise.all(
					accountItems.map(async account => {
						const balance = await request<AccountBalanceView>(
							`${path}/accounts/${encodeURIComponent(account.id)}/balances`,
							controller.signal
						);

						return [account.id, balance] as const;
					})
				);
				if (controller.signal.aborted) {
					return;
				}
				setAccounts(accountItems);
				setBalances(Object.fromEntries(balancePairs));
				setAccountId(current =>
					accountItems.some(account => account.id === current)
						? current
						: (accountItems.find(account => !account.closedAt)?.id ?? accountItems.at(0)?.id ?? '')
				);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(copy.loadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingBook(false);
				}
			});

		return () => controller.abort();
	}, [bookId, copy.loadError]);

	useEffect(() => {
		if (!bookId || !accountId) {
			setTransactions([]);

			return;
		}
		const controller = new AbortController();
		setLoadingTransactions(true);
		setTransactions([]);
		const query = new URLSearchParams({ accountId, limit: '6' });
		void request<unknown>(
			`/api/v1/books/${encodeURIComponent(bookId)}/transactions?${query.toString()}`,
			controller.signal
		)
			.then(response => setTransactions(pageItems<FinancialTransactionView>(response)))
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(copy.loadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingTransactions(false);
				}
			});

		return () => controller.abort();
	}, [accountId, bookId, copy.loadError]);

	return (
		<div className={styles.dashboard}>
			<div className={styles.heading}>
				<div>
					<h2>{copy.title}</h2>
					<p>{selectedBook?.name ?? copy.accounts}</p>
				</div>
				<button
					className={styles['primary-action']}
					onClick={onAddExpense}
					type='button'>
					{copy.addExpense}
				</button>
			</div>

			{books.length > 1 && (
				<label className={styles['book-picker']}>
					{copy.book}
					<select
						onChange={event => setBookId(event.currentTarget.value)}
						value={bookId}>
						{books.map(book => (
							<option
								key={book.id}
								value={book.id}>
								{book.name}
							</option>
						))}
					</select>
				</label>
			)}

			{error && (
				<p
					className={styles.error}
					role='alert'>
					{error}
				</p>
			)}
			{(loadingBooks || loadingBook) && (
				<p
					aria-live='polite'
					role='status'>
					{copy.loading}
				</p>
			)}

			<section
				aria-labelledby='summary-accounts-heading'
				className={styles.section}>
				<h3 id='summary-accounts-heading'>{copy.accounts}</h3>
				{!loadingBooks && !loadingBook && accounts.length === 0 ? (
					<p className={styles.empty}>{copy.emptyAccounts}</p>
				) : (
					<ul className={styles['account-list']}>
						{accounts.map(account => (
							<li
								className={styles['account-row']}
								key={account.id}>
								<span>{account.name}</span>
								<strong>
									{formatMoney(
										balances[account.id]?.totalMinor ?? account.openingBalanceMinor,
										selectedBook?.currencyCode ?? 'USD',
										language
									)}
								</strong>
							</li>
						))}
					</ul>
				)}
			</section>

			<section
				aria-labelledby='summary-transactions-heading'
				className={styles.section}>
				<div className={styles['section-heading']}>
					<h3 id='summary-transactions-heading'>{copy.recent}</h3>
					{activeAccounts.length > 0 && (
						<label className={styles['account-picker']}>
							<span>{copy.transactionAccount}</span>
							<select
								onChange={event => setAccountId(event.currentTarget.value)}
								value={accountId}>
								{activeAccounts.map(account => (
									<option
										key={account.id}
										value={account.id}>
										{account.name}
									</option>
								))}
							</select>
						</label>
					)}
				</div>
				{loadingTransactions ? (
					<p
						aria-live='polite'
						role='status'>
						{copy.loading}
					</p>
				) : transactions.length === 0 ? (
					<p className={styles.empty}>{copy.emptyTransactions}</p>
				) : (
					<ul className={styles['transaction-list']}>
						{transactions.map(transaction => (
							<li
								className={styles['transaction-row']}
								key={transaction.id}>
								<div>
									<strong>{transaction.payee || transaction.memo}</strong>
									<time dateTime={transaction.transactionDate}>{transaction.transactionDate}</time>
								</div>
								<strong className={transaction.amountMinor < 0 ? styles.expense : styles.income}>
									{formatMoney(
										transaction.amountMinor,
										selectedBook?.currencyCode ?? 'USD',
										language
									)}
								</strong>
							</li>
						))}
					</ul>
				)}
				{selectedAccount && (
					<span className={styles.srOnly}>
						{copy.account}: {selectedAccount.name}
					</span>
				)}
			</section>
		</div>
	);
}

export { SummaryDashboard };
