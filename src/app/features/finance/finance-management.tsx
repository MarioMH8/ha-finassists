import { useLocale } from '@app/i18n/locale-context';
import type {
	AccountBalanceView as AccountBalance,
	AccountView as Account,
	ConfirmActionProps,
} from '@modules/accounts/presentation';
import { AccountsPanel } from '@modules/accounts/presentation';
import type { ClassificationView as Classification } from '@modules/classifications/presentation';
import { ClassificationsPanel } from '@modules/classifications/presentation';
import type { ImportPreviewView as ImportPreview } from '@modules/imports/presentation';
import { ImportsPanel } from '@modules/imports/presentation';
import type { FinancialTransactionView as FinancialTransaction } from '@modules/ledger/presentation';
import { TransactionsPanel } from '@modules/ledger/presentation';
import type { ReactElement, SubmitEvent } from 'react';
import { useEffect, useEffectEvent, useState } from 'react';

import styles from './finance-management.module.css';
import { formatDate, formatMinorUnits, minorUnitsToInput, parseMinorUnits } from './finance-utilities';

interface Book {
	archivedAt: null | string;
	currencyCode: string;
	id: string;
	isDefault: boolean;
	name: string;
}

interface Page<T> {
	items: T[];
}

const SECTION = {
	ACCOUNTS: 'accounts',
	CLASSIFICATIONS: 'classifications',
	IMPORT: 'import',
	TRANSACTIONS: 'transactions',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	if (!response.ok) {
		let message = `HTTP ${String(response.status)}`;
		try {
			const body: unknown = await response.json();
			if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
				message = body.error;
			}
		} catch {
			// Keep the status message when the response has no JSON body.
		}
		throw new Error(message);
	}
	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

function isPage<T>(value: unknown): value is Page<T> {
	return typeof value === 'object' && value !== null && 'items' in value && Array.isArray(value.items);
}

function pageItems<T>(value: unknown): T[] {
	if (!isPage<T>(value)) {
		throw new TypeError('The server returned an invalid list.');
	}

	return value.items;
}

function formValue(form: HTMLFormElement, name: string): string {
	const value = new FormData(form).get(name);

	return typeof value === 'string' ? value.trim() : '';
}

function json(method: string, body?: unknown): RequestInit {
	return {
		...(body !== undefined && { body: JSON.stringify(body) }),
		headers: { 'content-type': 'application/json' },
		method,
	};
}

function ConfirmAction({
	cancelLabel,
	className,
	disabled = false,
	label,
	onConfirm,
	prompt,
}: ConfirmActionProps): ReactElement {
	const [confirming, setConfirming] = useState(false);

	return confirming ? (
		<div className={styles['row-actions']}>
			<span role='status'>{prompt}</span>
			<button
				className={className}
				disabled={disabled}
				onClick={() => {
					onConfirm();
					setConfirming(false);
				}}
				type='button'>
				{prompt}
			</button>
			<button
				className={styles.secondary}
				onClick={() => setConfirming(false)}
				type='button'>
				{cancelLabel}
			</button>
		</div>
	) : (
		<button
			className={className}
			disabled={disabled}
			onClick={() => setConfirming(true)}
			type='button'>
			{label}
		</button>
	);
}

interface FinanceManagementProps {
	initialSection?: Section;
}

function FinanceManagement({ initialSection = SECTION.ACCOUNTS }: FinanceManagementProps): ReactElement {
	const { copy, language } = useLocale();
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [balances, setBalances] = useState<Record<string, AccountBalance | undefined>>({});
	const [categories, setCategories] = useState<Classification[]>([]);
	const [classes, setClasses] = useState<Classification[]>([]);
	const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
	const [accountId, setAccountId] = useState('');
	const [section, setSection] = useState<Section>(initialSection);
	const [includeArchived, setIncludeArchived] = useState(false);
	const [includeClosed, setIncludeClosed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loadingBooks, setLoadingBooks] = useState(true);
	const [loadingBookData, setLoadingBookData] = useState(false);
	const [loadingTransactions, setLoadingTransactions] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [preview, setPreview] = useState<ImportPreview | undefined>();
	const [importFormat, setImportFormat] = useState<ImportPreview['format']>('qif');
	const [importFile, setImportFile] = useState<File | undefined>();
	const [payeeFile, setPayeeFile] = useState<File | undefined>();
	const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | undefined>();
	const [editingClassification, setEditingClassification] = useState<Classification | undefined>();

	async function loadBooks(signal?: AbortSignal): Promise<void> {
		const result = await request<unknown>('/api/v1/books', { signal });
		const items = pageItems<Book>(result);
		setBooks(items);
		setBookId(current =>
			items.some(book => book.id === current)
				? current
				: (items.find(book => !book.archivedAt)?.id ?? items.at(0)?.id ?? '')
		);
	}

	async function loadBookData(id: string, signal?: AbortSignal): Promise<void> {
		const query = new URLSearchParams({ includeClosed: String(includeClosed) });
		const classificationQuery = new URLSearchParams({ includeArchived: String(includeArchived) });
		const [accountResponse, categoryResponse, classResponse] = await Promise.all([
			request<unknown>(`/api/v1/books/${encodeURIComponent(id)}/accounts?${query.toString()}`, { signal }),
			request<unknown>(`/api/v1/books/${encodeURIComponent(id)}/categories?${classificationQuery.toString()}`, {
				signal,
			}),
			request<unknown>(`/api/v1/books/${encodeURIComponent(id)}/classes?${classificationQuery.toString()}`, {
				signal,
			}),
		]);
		const accountItems = pageItems<Account>(accountResponse);
		setAccounts(accountItems);
		setCategories(pageItems<Classification>(categoryResponse));
		setClasses(pageItems<Classification>(classResponse));
		setAccountId(current =>
			accountItems.some(account => account.id === current)
				? current
				: (accountItems.find(account => !account.closedAt)?.id ?? accountItems.at(0)?.id ?? '')
		);
		const balancePairs = await Promise.all(
			accountItems.map(
				async account =>
					[
						account.id,
						await request<AccountBalance>(
							`/api/v1/books/${encodeURIComponent(id)}/accounts/${encodeURIComponent(account.id)}/balances`,
							{ signal }
						),
					] as const
			)
		);
		setBalances(Object.fromEntries(balancePairs));
	}

	const loadBookDataInEffect = useEffectEvent(loadBookData);

	async function loadTransactions(id: string, selectedAccountId: string, signal?: AbortSignal): Promise<void> {
		if (!selectedAccountId) {
			setTransactions([]);

			return;
		}
		const result = await request<unknown>(
			`/api/v1/books/${encodeURIComponent(id)}/transactions?accountId=${encodeURIComponent(selectedAccountId)}`,
			{ signal }
		);
		setTransactions(pageItems<FinancialTransaction>(result));
	}

	useEffect(() => {
		const controller = new AbortController();
		setError('');
		setLoadingBooks(true);
		void loadBooks(controller.signal)
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.financeLoadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingBooks(false);
				}
			});

		return () => controller.abort();
	}, [copy.financeLoadError]);

	useEffect(() => {
		if (!bookId) {
			return;
		}
		const controller = new AbortController();
		setError('');
		setLoadingBookData(true);
		void loadBookDataInEffect(bookId, controller.signal)
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.financeLoadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingBookData(false);
				}
			});

		return () => controller.abort();
	}, [bookId, includeArchived, includeClosed, copy.financeLoadError]);

	useEffect(() => {
		if (!bookId || !accountId) {
			setTransactions([]);
			setLoadingTransactions(false);

			return;
		}
		const controller = new AbortController();
		setLoadingTransactions(true);
		void loadTransactions(bookId, accountId, controller.signal)
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.financeLoadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoadingTransactions(false);
				}
			});

		return () => controller.abort();
	}, [bookId, accountId, copy.financeLoadError]);

	async function perform(action: () => Promise<void>): Promise<void> {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			await action();
		} catch (error_) {
			setError(error_ instanceof Error ? error_.message : copy.financeActionError);
		} finally {
			setBusy(false);
		}
	}

	async function refresh(): Promise<void> {
		await loadBooks();
		if (bookId) {
			await loadBookData(bookId);
		}
		if (bookId && accountId) {
			await loadTransactions(bookId, accountId);
		}
	}

	async function submitBook(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		await perform(async () => {
			const book = await request<Book>(
				'/api/v1/books',
				json('POST', {
					currencyCode: formValue(form, 'currencyCode').toUpperCase(),
					name: formValue(form, 'name'),
				})
			);
			await loadBooks();
			setBookId(book.id);
			setNotice(copy.financeBookCreated);
			form.reset();
		});
	}

	async function submitAccount(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		await perform(async () => {
			const selectedBook = books.find(book => book.id === bookId);
			if (!selectedBook) {
				throw new Error(copy.financeChooseBook);
			}
			const openingBalanceMinor = parseMinorUnits(formValue(form, 'openingBalance'), selectedBook.currencyCode);
			const account = await request<Account>(
				`/api/v1/books/${encodeURIComponent(bookId)}/accounts`,
				json('POST', {
					kind: formValue(form, 'kind'),
					name: formValue(form, 'name'),
					openingBalanceMinor,
				})
			);
			await loadBookData(bookId);
			setAccountId(account.id);
			setNotice(copy.financeAccountCreated);
			form.reset();
		});
	}

	async function submitClassification(
		event: SubmitEvent<HTMLFormElement>,
		kind: 'categories' | 'classes'
	): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		await perform(async () => {
			const current = editingClassification;
			const parentId = formValue(form, 'parentId') || undefined;
			const body = { name: formValue(form, 'name'), parentId };
			await request(
				`/api/v1/books/${encodeURIComponent(bookId)}/${kind}${current ? `/${encodeURIComponent(current.id)}` : ''}`,
				json(current ? 'PATCH' : 'POST', body)
			);
			setEditingClassification(undefined);
			await loadBookData(bookId);
			setNotice(copy.financeSaved);
			form.reset();
		});
	}

	async function submitTransaction(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		await perform(async () => {
			const selectedBook = books.find(book => book.id === bookId);
			if (!selectedBook) {
				throw new Error(copy.financeChooseBook);
			}
			const amountMinor = parseMinorUnits(formValue(form, 'amount'), selectedBook.currencyCode);
			const category = formValue(form, 'categoryId') || undefined;
			const cls = formValue(form, 'classId') || undefined;
			const body = {
				accountId,
				amountMinor,
				memo: formValue(form, 'memo'),
				parts: category || cls ? [{ amountMinor, categoryId: category, classId: cls }] : [],
				payee: formValue(form, 'payee'),
				transactionDate: formValue(form, 'transactionDate'),
			};
			const current = editingTransaction;
			await request(
				`/api/v1/books/${encodeURIComponent(bookId)}/transactions${current ? `/${encodeURIComponent(current.id)}` : ''}`,
				json(current ? 'PATCH' : 'POST', body)
			);
			setEditingTransaction(undefined);
			await loadTransactions(bookId, accountId);
			await loadBookData(bookId);
			setNotice(copy.financeSaved);
			form.reset();
		});
	}

	async function submitTransfer(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		await perform(async () => {
			const selectedBook = books.find(book => book.id === bookId);
			if (!selectedBook) {
				throw new Error(copy.financeChooseBook);
			}
			const amountMinor = parseMinorUnits(formValue(form, 'amount'), selectedBook.currencyCode);
			await request(
				`/api/v1/books/${encodeURIComponent(bookId)}/transfers`,
				json('POST', {
					amountMinor,
					fromAccountId: formValue(form, 'fromAccountId'),
					memo: formValue(form, 'memo'),
					toAccountId: formValue(form, 'toAccountId'),
					transactionDate: formValue(form, 'transactionDate'),
				})
			);
			await loadBookData(bookId);
			await loadTransactions(bookId, accountId);
			setNotice(copy.financeTransferCreated);
			form.reset();
		});
	}

	async function runImport(action: 'commit' | 'preview'): Promise<void> {
		await perform(async () => {
			if (!importFile || !accountId) {
				throw new Error(copy.financeImportFileRequired);
			}
			const form = new FormData();
			form.set('accountId', accountId);
			form.set('format', importFormat);
			form.set('file', importFile);
			if (payeeFile) {
				form.set('payeeDirectory', payeeFile);
			}
			const path = `/api/v1/books/${encodeURIComponent(bookId)}/imports/${action}`;
			if (action === 'preview') {
				setPreview(await request<ImportPreview>(path, { body: form, method: 'POST' }));

				return;
			}
			await request<unknown>(path, { body: form, method: 'POST' });
			setPreview(undefined);
			setNotice(copy.financeImportCommitted);
			await loadTransactions(bookId, accountId);
			await loadBookData(bookId);
		});
	}

	function formatMoney(value: number): string {
		const currency = books.find(book => book.id === bookId)?.currencyCode ?? 'USD';

		return formatMinorUnits(value, currency, language);
	}

	function localized(key: keyof typeof copy, fallback: string): string {
		const value = copy[key];

		return typeof value === 'string' ? value : fallback;
	}

	const activeBook = books.find(book => book.id === bookId);

	return (
		<div className={styles.finance}>
			<div className={styles['top-row']}>
				<div>
					<p className={styles.eyebrow}>{copy.financeEyebrow}</p>
					<h2>{copy.financeTitle}</h2>
					<p>{copy.financeIntro}</p>
				</div>
				<button
					className={styles.secondary}
					disabled={busy}
					onClick={() => void perform(refresh)}
					type='button'>
					{copy.refresh}
				</button>
			</div>
			{error && (
				<p
					className={styles.error}
					role='alert'>
					{copy.financeActionError}: {error}
				</p>
			)}
			{notice && (
				<p
					aria-live='polite'
					className={styles.success}
					role='status'>
					{notice}
				</p>
			)}
			{(loadingBooks || loadingBookData || loadingTransactions) && (
				<p
					aria-live='polite'
					role='status'>
					{copy.financeLoading}
				</p>
			)}
			<section
				aria-labelledby='books-heading'
				className={styles.card}>
				<div className={styles['section-title']}>
					<div>
						<h3 id='books-heading'>{copy.financeBooks}</h3>
						<p>{copy.financeBookHelp}</p>
					</div>
					{books.length > 0 && (
						<label className={styles['book-select']}>
							{copy.financeSelectBook}
							<select
								aria-label={copy.financeSelectBook}
								onChange={event => setBookId(event.currentTarget.value)}
								value={bookId}>
								{books.map(book => (
									<option
										key={book.id}
										value={book.id}>
										{book.name} · {book.currencyCode}
										{book.archivedAt ? ` (${copy.financeArchived})` : ''}
									</option>
								))}
							</select>
						</label>
					)}
				</div>
				{activeBook && (
					<div className={styles['book-actions']}>
						<span>{activeBook.currencyCode}</span>
						{!activeBook.archivedAt && (
							<ConfirmAction
								cancelLabel={copy.cancel}
								className={styles.secondary}
								disabled={busy}
								label={copy.financeArchiveBook}
								onConfirm={() =>
									void perform(async () => {
										await request(
											`/api/v1/books/${encodeURIComponent(activeBook.id)}/archive`,
											json('POST')
										);
										await loadBooks();
										setNotice(copy.financeBookArchived);
									})
								}
								prompt={copy.financeConfirmArchiveBook}
							/>
						)}
						{activeBook.archivedAt && <span className={styles.badge}>{copy.financeArchived}</span>}
					</div>
				)}
				<form
					className={styles['inline-form']}
					onSubmit={event => void submitBook(event)}>
					<label>
						{copy.financeBookName}
						<input
							autoComplete='off'
							maxLength={80}
							name='name'
							required
						/>
					</label>
					<label>
						{copy.financeCurrency}
						<input
							autoComplete='currency'
							defaultValue='USD'
							maxLength={3}
							name='currencyCode'
							pattern='[A-Za-z]{3}'
							required
						/>
					</label>
					<button
						disabled={busy}
						type='submit'>
						{copy.financeCreateBook}
					</button>
				</form>
				{!loadingBooks && books.length === 0 && <p className={styles.empty}>{copy.financeNoBooks}</p>}
			</section>
			{activeBook && !activeBook.archivedAt && (
				<>
					<nav
						aria-label={copy.financeSections}
						className={styles.tabs}>
						{(
							[
								[SECTION.ACCOUNTS, copy.financeAccounts],
								[SECTION.CLASSIFICATIONS, copy.financeClassifications],
								[SECTION.TRANSACTIONS, copy.financeTransactions],
								[SECTION.IMPORT, copy.financeImport],
							] as const
						).map(([id, label]) => (
							<button
								aria-current={section === id ? 'page' : undefined}
								className={section === id ? styles.active : ''}
								key={id}
								onClick={() => setSection(id)}
								type='button'>
								{label}
							</button>
						))}
					</nav>
					{section === SECTION.ACCOUNTS && (
						<AccountsPanel
							accountId={accountId}
							accounts={accounts}
							balances={balances}
							busy={busy}
							copy={copy}
							formatMoney={formatMoney}
							isIncludeClosed={includeClosed}
							loadingBookData={loadingBookData}
							localized={localized}
							onAccountSelect={id => {
								setAccountId(id);
								setSection(SECTION.TRANSACTIONS);
							}}
							onIncludeClosedChange={setIncludeClosed}
							onSubmitAccount={event => void submitAccount(event)}
							onToggleAccount={account =>
								void perform(async () => {
									await request(
										`/api/v1/books/${encodeURIComponent(bookId)}/accounts/${encodeURIComponent(account.id)}/${account.closedAt ? 'open' : 'close'}`,
										json('POST')
									);
									await loadBookData(bookId);
								})
							}
							styles={styles}
						/>
					)}
					{section === SECTION.CLASSIFICATIONS && (
						<ClassificationsPanel
							busy={busy}
							categories={categories}
							classes={classes}
							ConfirmAction={ConfirmAction}
							copy={copy}
							editingClassification={editingClassification}
							isIncludeArchived={includeArchived}
							onCancelEdit={() => setEditingClassification(undefined)}
							onEdit={setEditingClassification}
							onIncludeArchivedChange={setIncludeArchived}
							onItemAction={(kind, item, action) =>
								void perform(async () => {
									await request(
										`/api/v1/books/${encodeURIComponent(bookId)}/${kind}/${encodeURIComponent(item.id)}${action === 'delete' ? '' : `/${action}`}`,
										action === 'delete' ? { method: 'DELETE' } : json('POST')
									);
									await loadBookData(bookId);
								})
							}
							onSubmit={(event, kind) => void submitClassification(event, kind)}
							styles={styles}
						/>
					)}
					{section === SECTION.TRANSACTIONS && (
						<TransactionsPanel
							accountId={accountId}
							accounts={accounts}
							busy={busy}
							categories={categories}
							classes={classes}
							ConfirmAction={ConfirmAction}
							copy={copy}
							editingTransaction={editingTransaction}
							formatDate={formatDate}
							formatMoney={formatMoney}
							language={language}
							loadingTransactions={loadingTransactions}
							localized={localized}
							minorUnitsToInput={minorUnitsToInput}
							onAccountChange={setAccountId}
							onCancelEdit={() => setEditingTransaction(undefined)}
							onDeleteTransaction={transaction =>
								void perform(async () => {
									await request(
										`/api/v1/books/${encodeURIComponent(bookId)}/transactions/${encodeURIComponent(transaction.id)}`,
										{ method: 'DELETE' }
									);
									await loadTransactions(bookId, accountId);
									await loadBookData(bookId);
								})
							}
							onEditTransaction={setEditingTransaction}
							onSetStatus={(transaction, status) =>
								void perform(async () => {
									await request(
										`/api/v1/books/${encodeURIComponent(bookId)}/transactions/${encodeURIComponent(transaction.id)}/status`,
										json('PUT', { status })
									);
									await loadTransactions(bookId, accountId);
									await loadBookData(bookId);
								})
							}
							onSubmitTransaction={event => void submitTransaction(event)}
							onSubmitTransfer={event => void submitTransfer(event)}
							selectedBookCurrency={activeBook.currencyCode}
							styles={styles}
							transactions={transactions}
						/>
					)}
					{section === SECTION.IMPORT && (
						<ImportsPanel
							accountId={accountId}
							accounts={accounts}
							busy={busy}
							copy={copy}
							formatDate={formatDate}
							formatMinorUnits={formatMinorUnits}
							formatMoney={formatMoney}
							importFile={importFile}
							importFormat={importFormat}
							language={language}
							onAccountChange={id => {
								setAccountId(id);
								setPreview(undefined);
							}}
							onCommit={() => void runImport('commit')}
							onFormatChange={format => {
								setImportFormat(format);
								setPreview(undefined);
							}}
							onImportFileChange={file => {
								setImportFile(file);
								setPreview(undefined);
							}}
							onPayeeFileChange={file => {
								setPayeeFile(file);
								setPreview(undefined);
							}}
							onPreview={() => void runImport('preview')}
							preview={preview}
							styles={styles}
						/>
					)}
				</>
			)}
			{!activeBook && <p className={styles.empty}>{copy.financeNoBooks}</p>}
		</div>
	);
}

export { FinanceManagement, type FinanceManagementProps };
