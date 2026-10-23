import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement, SubmitEvent } from 'react';
import { useEffect, useState } from 'react';

import styles from './budget-planning.module.css';

interface Book {
	currencyCode: string;
	id: string;
	name: string;
}

interface Account {
	closedAt: null | string;
	id: string;
	name: string;
}

interface Classification {
	archivedAt: null | string;
	id: string;
	name: string;
}

interface Budget {
	accountId: string;
	categoryId: null | string;
	classId: null | string;
	currencyCode: string;
	id: string;
	name: string;
	periodEnd: string;
	periodStart: string;
	plannedMinor: number;
}

interface BudgetReport {
	actualMinor: number;
	budget: Budget;
	remainingMinor: number;
}

const COPY = {
	en: {
		account: 'Account',
		actual: 'Spent',
		allAccounts: 'Choose an account',
		book: 'Book',
		budgetName: 'Budget name',
		budgets: 'Budgets',
		category: 'Category',
		className: 'Class',
		create: 'Create budget',
		creating: 'Creating…',
		empty: 'No budgets yet. Create one to start tracking a plan.',
		end: 'End date',
		error: 'Could not load or save budgets.',
		load: 'Loading budgets…',
		namePlaceholder: 'e.g. Groceries',
		noBooks: 'Create a book before planning a budget.',
		noReport: 'Could not load this report.',
		planned: 'Planned amount',
		remaining: 'Remaining',
		report: 'View report',
		reportTitle: 'Budget report',
		saveSuccess: 'Budget created.',
		select: 'Select',
		start: 'Start date',
		title: 'Budget planning',
		unscoped: 'No category',
		unscopedClass: 'No class',
	},
	es: {
		account: 'Cuenta',
		actual: 'Gastado',
		allAccounts: 'Elige una cuenta',
		book: 'Libro',
		budgetName: 'Nombre del presupuesto',
		budgets: 'Presupuestos',
		category: 'Categoría',
		className: 'Clase',
		create: 'Crear presupuesto',
		creating: 'Creando…',
		empty: 'Todavía no hay presupuestos. Crea uno para empezar a controlar un plan.',
		end: 'Fecha final',
		error: 'No se pudieron cargar o guardar los presupuestos.',
		load: 'Cargando presupuestos…',
		namePlaceholder: 'p. ej. Compra',
		noBooks: 'Crea un libro antes de planificar un presupuesto.',
		noReport: 'No se pudo cargar este informe.',
		planned: 'Importe previsto',
		remaining: 'Restante',
		report: 'Ver informe',
		reportTitle: 'Informe del presupuesto',
		saveSuccess: 'Presupuesto creado.',
		select: 'Seleccionar',
		start: 'Fecha inicial',
		title: 'Planificación de presupuestos',
		unscoped: 'Sin categoría',
		unscopedClass: 'Sin clase',
	},
} as const;

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
			// The status remains useful when an error response has no JSON body.
		}
		throw new Error(message);
	}
	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

function items<T>(response: unknown): T[] {
	if (typeof response !== 'object' || response === null || !('items' in response) || !Array.isArray(response.items)) {
		throw new TypeError('The server returned an invalid list.');
	}

	return response.items as T[];
}

function currencyMinorInput(value: string, currencyCode: string): number {
	const normalized = value.trim().replace(',', '.');
	const match = /^(?<whole>\d+)(?:\.(?<fraction>\d*))?$|^\.(?<leadingFraction>\d+)$/u.exec(normalized);
	if (!match) {
		throw new TypeError('Enter a valid non-negative amount.');
	}
	const digits =
		new Intl.NumberFormat('en', { currency: currencyCode, style: 'currency' }).resolvedOptions()
			.maximumFractionDigits ?? 2;
	const groups = match.groups;
	const fraction = groups?.fraction ?? groups?.leadingFraction ?? '';
	if (fraction.length > digits) {
		throw new TypeError(`This currency allows at most ${String(digits)} decimal places.`);
	}
	const scale = 10n ** BigInt(digits);
	const minor = BigInt(groups?.whole ?? '0') * scale + BigInt(fraction.padEnd(digits, '0') || '0');
	if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new RangeError('Amount is outside the supported range.');
	}

	return Number(minor);
}

function formatMoney(amountMinor: number, currencyCode: string, language: 'en' | 'es'): string {
	const digits =
		new Intl.NumberFormat('en', { currency: currencyCode, style: 'currency' }).resolvedOptions()
			.maximumFractionDigits ?? 2;

	return new Intl.NumberFormat(language, { currency: currencyCode, style: 'currency' }).format(
		amountMinor / 10 ** digits
	);
}

function formatDate(date: string, language: 'en' | 'es'): string {
	return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${date}T12:00:00.000Z`)
	);
}

function json(method: string, body: unknown): RequestInit {
	return { body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, method };
}

function BudgetPlanning(): ReactElement {
	const { language } = useLocale();
	const copy = COPY[language];
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [categories, setCategories] = useState<Classification[]>([]);
	const [classes, setClasses] = useState<Classification[]>([]);
	const [budgets, setBudgets] = useState<Budget[]>([]);
	const [report, setReport] = useState<BudgetReport | undefined>();
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		void request<unknown>('/api/v1/books', { signal: controller.signal })
			.then(result => {
				const available = items<Book>(result);
				setBooks(available);
				setBookId(current =>
					available.some(book => book.id === current) ? current : (available[0]?.id ?? '')
				);
			})
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.error);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, [copy.error]);

	useEffect(() => {
		if (!bookId) {
			setAccounts([]);
			setCategories([]);
			setClasses([]);
			setBudgets([]);

			return;
		}
		const controller = new AbortController();
		setLoading(true);
		setError('');
		const base = `/api/v1/books/${encodeURIComponent(bookId)}`;
		void Promise.all([
			request<unknown>(`${base}/accounts`, { signal: controller.signal }),
			request<unknown>(`${base}/categories`, { signal: controller.signal }),
			request<unknown>(`${base}/classes`, { signal: controller.signal }),
			request<unknown>(`${base}/budgets`, { signal: controller.signal }),
		])
			.then(([accountResult, categoryResult, classResult, budgetResult]) => {
				setAccounts(items<Account>(accountResult));
				setCategories(items<Classification>(categoryResult));
				setClasses(items<Classification>(classResult));
				setBudgets(items<Budget>(budgetResult));
			})
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.error);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, [bookId, copy.error]);

	const selectedBook = books.find(book => book.id === bookId);
	const activeAccounts = accounts.filter(account => account.closedAt === null);

	async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!selectedBook) {
			return;
		}
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const stringValue = (name: string): string => {
			const value = form.get(name);

			return typeof value === 'string' ? value.trim() : '';
		};
		setBusy(true);
		setError('');
		setNotice('');
		try {
			const budgetPath = `/api/v1/books/${encodeURIComponent(bookId)}/budgets`;
			const budgetBody = json('POST', {
				accountId: stringValue('accountId'),
				...(stringValue('categoryId') && { categoryId: stringValue('categoryId') }),
				...(stringValue('classId') && { classId: stringValue('classId') }),
				name: stringValue('name'),
				periodEnd: stringValue('periodEnd'),
				periodStart: stringValue('periodStart'),
				plannedMinor: currencyMinorInput(stringValue('planned'), selectedBook.currencyCode),
			});
			await request<Budget>(budgetPath, budgetBody);
			const refreshed = await request<unknown>(`/api/v1/books/${encodeURIComponent(bookId)}/budgets`);
			setBudgets(items<Budget>(refreshed));
			setReport(undefined);
			formElement.reset();
			setNotice(copy.saveSuccess);
		} catch (error_) {
			setError(error_ instanceof Error ? error_.message : copy.error);
		} finally {
			setBusy(false);
		}
	}

	async function showReport(budget: Budget): Promise<void> {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			const result = await request<BudgetReport>(
				`/api/v1/books/${encodeURIComponent(bookId)}/budgets/${encodeURIComponent(budget.id)}/report`
			);
			setReport(result);
		} catch (error_) {
			setError(error_ instanceof Error ? error_.message : copy.noReport);
		} finally {
			setBusy(false);
		}
	}

	function accountName(id: string): string {
		return accounts.find(account => account.id === id)?.name ?? id;
	}

	return (
		<section
			aria-labelledby='budget-planning-title'
			className={styles.planning}>
			<header className={styles.header}>
				<div>
					<h2 id='budget-planning-title'>{copy.title}</h2>
					<p>{copy.budgets}</p>
				</div>
				{books.length > 1 && (
					<label className={styles.field}>
						{copy.book}
						<select
							aria-label={copy.book}
							onChange={event => {
								setBookId(event.currentTarget.value);
								setReport(undefined);
							}}
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
			</header>

			{error && (
				<p
					className={styles.message}
					role='alert'>
					{error}
				</p>
			)}
			{notice && (
				<p
					className={styles.notice}
					role='status'>
					{notice}
				</p>
			)}
			{loading && (
				<p
					className={styles.loading}
					role='status'>
					{copy.load}
				</p>
			)}
			{!loading && books.length === 0 && <p className={styles.empty}>{copy.noBooks}</p>}
			{selectedBook && (
				<>
					<section
						aria-labelledby='budget-list-title'
						className={styles.surface}>
						<div className={styles.sectionHeading}>
							<div>
								<h3 id='budget-list-title'>{copy.budgets}</h3>
							</div>
						</div>
						{budgets.length === 0 ? (
							<p className={styles.empty}>{copy.empty}</p>
						) : (
							<ul className={styles.list}>
								{budgets.map(budget => (
									<li
										className={styles.budgetRow}
										key={budget.id}>
										<div>
											<h4>{budget.name}</h4>
											<p>
												{accountName(budget.accountId)} ·{' '}
												{formatDate(budget.periodStart, language)} –{' '}
												{formatDate(budget.periodEnd, language)}
											</p>
											<p>{formatMoney(budget.plannedMinor, budget.currencyCode, language)}</p>
										</div>
										<button
											className={styles.rowButton}
											disabled={busy}
											onClick={() => void showReport(budget)}
											type='button'>
											{copy.report}
										</button>
									</li>
								))}
							</ul>
						)}
						{report && (
							<div
								aria-live='polite'
								className={styles.report}>
								<h4>
									{copy.reportTitle}: {report.budget.name}
								</h4>
								<div className={styles.reportLine}>
									<span>{copy.planned}</span>
									<strong>
										{formatMoney(report.budget.plannedMinor, report.budget.currencyCode, language)}
									</strong>
								</div>
								<div className={styles.reportLine}>
									<span>{copy.actual}</span>
									<strong>
										{formatMoney(report.actualMinor, report.budget.currencyCode, language)}
									</strong>
								</div>
								<div
									className={`${styles.reportLine} ${report.remainingMinor < 0 ? styles.over : styles.remaining}`}>
									<span>{copy.remaining}</span>
									<strong>
										{formatMoney(report.remainingMinor, report.budget.currencyCode, language)}
									</strong>
								</div>
							</div>
						)}
					</section>

					<section
						aria-labelledby='budget-create-title'
						className={styles.surface}>
						<div className={styles.sectionHeading}>
							<h3 id='budget-create-title'>{copy.create}</h3>
						</div>
						<form
							className={styles.form}
							onSubmit={event => void submit(event)}>
							<label className={styles.field}>
								{copy.budgetName}
								<input
									maxLength={80}
									name='name'
									placeholder={copy.namePlaceholder}
									required
								/>
							</label>
							<label className={styles.field}>
								{copy.account}
								<select
									defaultValue=''
									name='accountId'
									required>
									<option
										disabled
										value=''>
										{copy.allAccounts}
									</option>
									{activeAccounts.map(account => (
										<option
											key={account.id}
											value={account.id}>
											{account.name}
										</option>
									))}
								</select>
							</label>
							<label className={styles.field}>
								{copy.category}
								<select
									defaultValue=''
									name='categoryId'>
									<option value=''>{copy.unscoped}</option>
									{categories
										.filter(category => category.archivedAt === null)
										.map(category => (
											<option
												key={category.id}
												value={category.id}>
												{category.name}
											</option>
										))}
								</select>
							</label>
							<label className={styles.field}>
								{copy.className}
								<select
									defaultValue=''
									name='classId'>
									<option value=''>{copy.unscopedClass}</option>
									{classes
										.filter(classification => classification.archivedAt === null)
										.map(classification => (
											<option
												key={classification.id}
												value={classification.id}>
												{classification.name}
											</option>
										))}
								</select>
							</label>
							<label className={styles.field}>
								{copy.planned}
								<input
									inputMode='decimal'
									min='0'
									name='planned'
									required
									step='any'
									type='number'
								/>
							</label>
							<label className={styles.field}>
								{copy.start}
								<input
									name='periodStart'
									required
									type='date'
								/>
							</label>
							<label className={styles.field}>
								{copy.end}
								<input
									name='periodEnd'
									required
									type='date'
								/>
							</label>
							<button
								aria-busy={busy}
								className={styles.button}
								disabled={busy || activeAccounts.length === 0}
								type='submit'>
								{busy ? copy.creating : copy.create}
							</button>
						</form>
					</section>
				</>
			)}
		</section>
	);
}

export { BudgetPlanning };
