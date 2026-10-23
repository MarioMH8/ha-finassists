import { useLocale } from '@app/i18n/locale-context';
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

interface Account {
	closedAt: null | string;
	id: string;
	kind: string;
	name: string;
	openingBalanceMinor: number;
}

interface Classification {
	archivedAt: null | string;
	id: string;
	name: string;
	parentId: null | string;
}

interface TransactionPart {
	amountMinor: number;
	categoryId: null | string;
	classId: null | string;
	id: string;
	memo: string;
}

interface FinancialTransaction {
	accountId: string;
	amountMinor: number;
	id: string;
	memo: string;
	parts: TransactionPart[];
	payee: string;
	status: string;
	transactionDate: string;
	transferId: null | string;
}

interface AccountBalance {
	postedMinor: number;
	reconciledMinor: number;
	totalMinor: number;
}

interface Page<T> {
	items: T[];
}

interface ImportPreview {
	canCommit: boolean;
	currencyCode: string;
	errorCount: number;
	format: 'payee_csv' | 'qif' | 'statement_csv';
	ignoredFields: Record<string, number>;
	issues: { code: string; line: number; message: string; severity: string }[];
	payeeDirectory: { active: boolean; code: string; line: number; name: string }[];
	payeesNormalized: number;
	rows: {
		amountMinor: number;
		line: number;
		memo: string;
		payee: string;
		possibleDuplicate: boolean;
		transactionDate: string;
	}[];
	summary: { firstDate: null | string; lastDate: null | string; rowCount: number; totalMinor: number };
	warningCount: number;
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
}: {
	cancelLabel: string;
	className?: string;
	disabled?: boolean;
	label: string;
	onConfirm: () => void;
	prompt: string;
}): ReactElement {
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

function FinanceManagement(): ReactElement {
	const { copy, language } = useLocale();
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [balances, setBalances] = useState<Record<string, AccountBalance | undefined>>({});
	const [categories, setCategories] = useState<Classification[]>([]);
	const [classes, setClasses] = useState<Classification[]>([]);
	const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
	const [accountId, setAccountId] = useState('');
	const [section, setSection] = useState<Section>(SECTION.ACCOUNTS);
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

	function renderClassificationList(kind: 'categories' | 'classes', items: Classification[]): ReactElement {
		return (
			<ul className={styles.list}>
				{items.map(item => (
					<li
						className={styles.row}
						key={item.id}>
						<div>
							<strong>{item.name}</strong>
							{item.archivedAt && <span className={styles.badge}>{copy.financeArchived}</span>}
						</div>
						<div className={styles['row-actions']}>
							{!item.archivedAt && (
								<button
									className={styles.secondary}
									disabled={busy}
									onClick={() => {
										setEditingClassification(item);
									}}
									type='button'>
									{copy.financeEdit}
								</button>
							)}
							<button
								className={styles.secondary}
								disabled={busy}
								onClick={() =>
									void perform(async () => {
										const operation = item.archivedAt ? 'restore' : 'archive';
										await request(
											`/api/v1/books/${encodeURIComponent(bookId)}/${kind}/${encodeURIComponent(item.id)}/${operation}`,
											json('POST')
										);
										await loadBookData(bookId);
									})
								}
								type='button'>
								{item.archivedAt ? copy.financeRestore : copy.financeArchive}
							</button>
							<ConfirmAction
								cancelLabel={copy.cancel}
								className={styles.secondary}
								disabled={busy}
								label={copy.financeDelete}
								onConfirm={() =>
									void perform(async () => {
										await request(
											`/api/v1/books/${encodeURIComponent(bookId)}/${kind}/${encodeURIComponent(item.id)}`,
											{ method: 'DELETE' }
										);
										await loadBookData(bookId);
									})
								}
								prompt={copy.financeConfirmDelete}
							/>
						</div>
					</li>
				))}
			</ul>
		);
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
						)}{' '}
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
						<section
							aria-labelledby='accounts-heading'
							className={styles.card}>
							<div className={styles['section-title']}>
								<div>
									<h3 id='accounts-heading'>{copy.financeAccounts}</h3>
									<p>{copy.financeAccountsHelp}</p>
								</div>
								<label className={styles.check}>
									<input
										checked={includeClosed}
										onChange={event => setIncludeClosed(event.currentTarget.checked)}
										type='checkbox'
									/>
									{copy.financeIncludeClosed}
								</label>
							</div>
							{loadingBookData ? (
								<p role='status'>{copy.financeLoading}</p>
							) : accounts.length > 0 ? (
								<ul className={styles.list}>
									{accounts.map(account => (
										<li
											className={`${styles.row} ${account.id === accountId ? styles['selected-row'] : ''}`}
											key={account.id}>
											<button
												className={styles['account-button']}
												onClick={() => {
													setAccountId(account.id);
													setSection(SECTION.TRANSACTIONS);
												}}
												type='button'>
												<strong>{account.name}</strong>
												<span>
													{localized(
														`financeKind_${account.kind}` as keyof typeof copy,
														account.kind
													)}
													{account.closedAt ? ` · ${copy.financeClosed}` : ''}
												</span>
											</button>
											<div className={styles.balance}>
												<strong>
													{formatMoney(
														balances[account.id]?.totalMinor ?? account.openingBalanceMinor
													)}
												</strong>
												<small>
													{copy.financePosted}:{' '}
													{formatMoney(
														balances[account.id]?.postedMinor ?? account.openingBalanceMinor
													)}
												</small>
											</div>
											<button
												className={styles.secondary}
												disabled={busy}
												onClick={() =>
													void perform(async () => {
														await request(
															`/api/v1/books/${encodeURIComponent(bookId)}/accounts/${encodeURIComponent(account.id)}/${account.closedAt ? 'open' : 'close'}`,
															json('POST')
														);
														await loadBookData(bookId);
													})
												}
												type='button'>
												{account.closedAt ? copy.financeOpen : copy.financeClose}
											</button>
										</li>
									))}
								</ul>
							) : (
								<p className={styles.empty}>{copy.financeNoAccounts}</p>
							)}
							<form
								className={styles['inline-form']}
								onSubmit={event => void submitAccount(event)}>
								<label>
									{copy.financeAccountName}
									<input
										autoComplete='off'
										maxLength={80}
										name='name'
										required
									/>
								</label>
								<label>
									{copy.financeAccountType}
									<select name='kind'>
										<option value='checking'>{copy.financeKind_checking}</option>
										<option value='savings'>{copy.financeKind_savings}</option>
										<option value='credit'>{copy.financeKind_credit}</option>
										<option value='asset'>{copy.financeKind_asset}</option>
										<option value='liability'>{copy.financeKind_liability}</option>
									</select>
								</label>
								<label>
									{copy.financeOpeningBalance}
									<input
										defaultValue='0'
										inputMode='decimal'
										name='openingBalance'
										required
										step='any'
										type='number'
									/>
								</label>
								<button
									disabled={busy}
									type='submit'>
									{copy.financeCreateAccount}
								</button>
							</form>
						</section>
					)}
					{section === SECTION.CLASSIFICATIONS && (
						<section className={styles['two-column']}>
							{(['categories', 'classes'] as const).map(kind => (
								<div
									className={styles.card}
									key={kind}>
									<div className={styles['section-title']}>
										<div>
											<h3>
												{kind === 'categories' ? copy.financeCategories : copy.financeClasses}
											</h3>
											<p>
												{kind === 'categories'
													? copy.financeCategoriesHelp
													: copy.financeClassesHelp}
											</p>
										</div>
										<label className={styles.check}>
											<input
												checked={includeArchived}
												onChange={event => setIncludeArchived(event.currentTarget.checked)}
												type='checkbox'
											/>
											{copy.financeIncludeArchived}
										</label>
									</div>
									{renderClassificationList(kind, kind === 'categories' ? categories : classes)}
									<form
										className={styles['stack-form']}
										key={`${kind}-${editingClassification?.id ?? 'new'}`}
										onSubmit={event => void submitClassification(event, kind)}>
										<label>
											{editingClassification ? copy.financeEditName : copy.financeName}
											<input
												autoComplete='off'
												defaultValue={editingClassification?.name ?? ''}
												maxLength={80}
												name='name'
												required
											/>
										</label>
										<label>
											{copy.financeParent}
											<select
												defaultValue={editingClassification?.parentId ?? ''}
												name='parentId'>
												<option value=''>{copy.financeNoParent}</option>
												{(kind === 'categories' ? categories : classes)
													.filter(
														item =>
															item.id !== editingClassification?.id && !item.archivedAt
													)
													.map(item => (
														<option
															key={item.id}
															value={item.id}>
															{item.name}
														</option>
													))}
											</select>
										</label>
										<div className={styles['row-actions']}>
											<button
												disabled={busy}
												type='submit'>
												{editingClassification ? copy.financeSave : copy.financeCreate}
											</button>
											{editingClassification && (
												<button
													className={styles.secondary}
													onClick={() => setEditingClassification(undefined)}
													type='button'>
													{copy.cancel}
												</button>
											)}
										</div>
									</form>
								</div>
							))}
						</section>
					)}
					{section === SECTION.TRANSACTIONS && (
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
										onChange={event => setAccountId(event.currentTarget.value)}
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
													<td
														className={
															transaction.amountMinor < 0
																? styles.negative
																: styles.positive
														}>
														{formatMoney(transaction.amountMinor)}
													</td>
													<td>
														{localized(
															`financeStatus_${transaction.status}` as keyof typeof copy,
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
																onClick={() => {
																	setEditingTransaction(transaction);
																}}
																type='button'>
																{copy.financeEdit}
															</button>
															<select
																aria-label={`${copy.financeStatus} ${transaction.payee}`}
																disabled={busy}
																onChange={event => {
																	const status = event.currentTarget.value;
																	if (status) {
																		void perform(async () => {
																			await request(
																				`/api/v1/books/${encodeURIComponent(bookId)}/transactions/${encodeURIComponent(transaction.id)}/status`,
																				json('PUT', { status })
																			);
																			await loadTransactions(bookId, accountId);
																			await loadBookData(bookId);
																		});
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
																			{localized(
																				`financeStatus_${status}` as keyof typeof copy,
																				status
																			)}
																		</option>
																	))}
															</select>
															<ConfirmAction
																cancelLabel={copy.cancel}
																className={styles.secondary}
																disabled={busy}
																label={copy.financeDelete}
																onConfirm={() =>
																	void perform(async () => {
																		await request(
																			`/api/v1/books/${encodeURIComponent(bookId)}/transactions/${encodeURIComponent(transaction.id)}`,
																			{ method: 'DELETE' }
																		);
																		await loadTransactions(bookId, accountId);
																		await loadBookData(bookId);
																	})
																}
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
								onSubmit={event => void submitTransaction(event)}>
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
													? minorUnitsToInput(
															editingTransaction.amountMinor,
															activeBook.currencyCode
														)
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
											onClick={() => setEditingTransaction(undefined)}
											type='button'>
											{copy.cancel}
										</button>
									)}
								</div>
							</form>
							<form
								className={styles['stack-form']}
								onSubmit={event => void submitTransfer(event)}>
								<h4>{copy.financeNewTransfer}</h4>
								<div className={styles['form-grid']}>
									<label>
										{copy.financeFromAccount}
										<select name='fromAccountId'>
											{accounts
												.filter(item => !item.closedAt)
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
										{copy.financeToAccount}
										<select name='toAccountId'>
											{accounts
												.filter(item => !item.closedAt)
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
									disabled={busy || accounts.filter(item => !item.closedAt).length < 2}
									type='submit'>
									{copy.financeCreateTransfer}
								</button>
							</form>
						</section>
					)}
					{section === SECTION.IMPORT && (
						<section className={styles.card}>
							<h3>{copy.financeImport}</h3>
							<p>{copy.financeImportHelp}</p>
							<div className={styles['form-grid']}>
								<label>
									{copy.financeAccount}
									<select
										onChange={event => {
											setAccountId(event.currentTarget.value);
											setPreview(undefined);
										}}
										value={accountId}>
										{accounts
											.filter(item => !item.closedAt)
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
									{copy.financeImportFormat}
									<select
										name='importFormat'
										onChange={event => {
											setImportFormat(event.currentTarget.value as ImportPreview['format']);
											setPreview(undefined);
										}}
										value={importFormat}>
										<option value='qif'>{copy.financeFormatQif}</option>
										<option value='statement_csv'>{copy.financeFormatStatementCsv}</option>
										<option value='payee_csv'>{copy.financeFormatPayeeCsv}</option>
									</select>
								</label>
								<label>
									{copy.financeImportFile}
									<input
										accept='.qif,.csv,text/csv,text/plain'
										onChange={event => {
											setImportFile(event.currentTarget.files?.[0]);
											setPreview(undefined);
										}}
										type='file'
									/>
								</label>
								<label>
									{copy.financePayeeDirectory}
									<input
										accept='.csv,text/csv'
										onChange={event => {
											setPayeeFile(event.currentTarget.files?.[0]);
											setPreview(undefined);
										}}
										type='file'
									/>
								</label>
							</div>
							<p className={styles.hint}>{copy.financeStatementCsvHint}</p>
							<div className={styles['row-actions']}>
								<button
									disabled={busy || !importFile || !accountId}
									onClick={() => void runImport('preview')}
									type='button'>
									{copy.financePreviewImport}
								</button>
								<button
									className={styles.secondary}
									disabled={busy || !preview?.canCommit}
									onClick={() => void runImport('commit')}
									type='button'>
									{copy.financeCommitImport}
								</button>
							</div>
							{preview && (
								<div
									aria-live='polite'
									className={styles.preview}
									role='status'>
									<h4>{copy.financePreview}</h4>
									<p>
										{copy.financeImportRows}: {String(preview.summary.rowCount)} ·{' '}
										{copy.financeImportTotal}:{' '}
										{formatMinorUnits(preview.summary.totalMinor, preview.currencyCode, language)}
									</p>
									{preview.summary.firstDate && preview.summary.lastDate && (
										<p>
											{copy.financeImportDateRange}:{' '}
											{formatDate(preview.summary.firstDate, language)} –{' '}
											{formatDate(preview.summary.lastDate, language)}
										</p>
									)}
									{preview.errorCount > 0 && (
										<span className={styles.badge}>
											{copy.financeImportErrors}: {String(preview.errorCount)}
										</span>
									)}
									{preview.warningCount > 0 && (
										<span className={styles.badge}>
											{copy.financeImportWarnings}: {String(preview.warningCount)}
										</span>
									)}
									{preview.payeesNormalized > 0 && (
										<span className={styles.badge}>
											{copy.financeImportNormalizedPayees}: {String(preview.payeesNormalized)}
										</span>
									)}
									{preview.rows.length > 0 && (
										<div className={styles['table-wrap']}>
											<table>
												<thead>
													<tr>
														<th>{copy.financeDate}</th>
														<th>{copy.financePayee}</th>
														<th>{copy.financeAmount}</th>
														<th>{copy.financeMemo}</th>
													</tr>
												</thead>
												<tbody>
													{preview.rows.map(row => (
														<tr key={String(row.line)}>
															<td>{formatDate(row.transactionDate, language)}</td>
															<td>
																{row.payee || '—'}
																{row.possibleDuplicate && (
																	<span className={styles.badge}>
																		{copy.financeImportDuplicates}
																	</span>
																)}
															</td>
															<td>{formatMoney(row.amountMinor)}</td>
															<td>{row.memo || '—'}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
									{preview.payeeDirectory.length > 0 && (
										<ul>
											{preview.payeeDirectory.map(entry => (
												<li key={`${entry.code}-${String(entry.line)}`}>
													{entry.code} — {entry.name}
												</li>
											))}
										</ul>
									)}
									{preview.issues.length > 0 && (
										<ul>
											{preview.issues.map(issue => (
												<li key={`${String(issue.line)}-${issue.code}`}>
													{copy.financeRow} {String(issue.line)}: {issue.message}
												</li>
											))}
										</ul>
									)}
								</div>
							)}
						</section>
					)}
				</>
			)}
			{!activeBook && <p className={styles.empty}>{copy.financeNoBooks}</p>}
		</div>
	);
}

export { FinanceManagement };
