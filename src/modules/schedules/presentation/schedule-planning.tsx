import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement, SubmitEvent } from 'react';
import { useEffect, useState } from 'react';

import styles from './schedule-planning.module.css';

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

type Frequency = 'daily' | 'monthly' | 'one_time' | 'quarterly' | 'weekly' | 'yearly';
type ScheduleStatus = 'active' | 'canceled' | 'completed' | 'paused';

interface Schedule {
	accountId: string;
	amountMinor: number;
	bookId: string;
	endDate?: string;
	frequency: Frequency;
	id: string;
	interval: number;
	memo: string;
	occurrenceLimit?: number;
	payee: string;
	startDate: string;
	status: ScheduleStatus;
}

interface Occurrence {
	accountId: string;
	amountMinor: number;
	dueDate: string;
	id: string;
	occurrenceNumber: number;
	payee: string;
	scheduleId: string;
	status: 'pending' | 'recorded' | 'skipped';
	transactionId?: string;
}

interface Transaction {
	accountId: string;
	amountMinor: number;
	id: string;
	payee: string;
	transactionDate: string;
}

const COPY = {
	en: {
		account: 'Account',
		amount: 'Amount (+ income, − expense)',
		cancel: 'Cancel',
		canceled: 'Canceled',
		canceledNotice: 'Schedule canceled.',
		changeTo: 'Change to',
		create: 'Create scheduled payment',
		creating: 'Saving…',
		daily: 'Daily',
		dateThrough: 'Generate through',
		end: 'End date (optional)',
		error: 'Could not load or save schedules.',
		every: 'Every',
		frequency: 'Frequency',
		generate: 'Generate occurrences',
		generateSuccess: 'Occurrences generated.',
		generating: 'Generating…',
		limit: 'Occurrence limit (optional)',
		load: 'Loading scheduled payments…',
		memo: 'Memo',
		monthly: 'Monthly',
		name: 'Payee',
		noAccounts: 'Add an open account before creating a schedule.',
		noBooks: 'Create a book before planning scheduled payments.',
		noOccurrences: 'No occurrences generated yet.',
		noSchedules: 'No scheduled payments yet. Create one to plan a future payment.',
		occurrence: 'Occurrence',
		occurrences: 'Occurrences',
		one_time: 'One time',
		open: 'View occurrences',
		pause: 'Pause',
		paused: 'Paused',
		quarterly: 'Quarterly',
		record: 'Record against transaction',
		recorded: 'Recorded',
		resume: 'Resume',
		save: 'Save changes',
		saved: 'Schedule saved.',
		scheduleTitle: 'Scheduled payments',
		start: 'Start date',
		status: 'Status',
		title: 'Payment planning',
		transaction: 'Matching transaction',
		transactionMissing: 'No matching transaction is available yet.',
		transactionNone: 'Choose a transaction',
		update: 'Edit',
		weekly: 'Weekly',
		yearly: 'Yearly',
	},
	es: {
		account: 'Cuenta',
		amount: 'Importe (+ ingreso, − gasto)',
		cancel: 'Cancelar',
		canceled: 'Cancelado',
		canceledNotice: 'Pago programado cancelado.',
		changeTo: 'Cambiar a',
		create: 'Crear pago programado',
		creating: 'Guardando…',
		daily: 'Diario',
		dateThrough: 'Generar hasta',
		end: 'Fecha final (opcional)',
		error: 'No se pudieron cargar o guardar los pagos.',
		every: 'Cada',
		frequency: 'Frecuencia',
		generate: 'Generar ocurrencias',
		generateSuccess: 'Ocurrencias generadas.',
		generating: 'Generando…',
		limit: 'Límite de ocurrencias (opcional)',
		load: 'Cargando pagos programados…',
		memo: 'Descripción',
		monthly: 'Mensual',
		name: 'Beneficiario',
		noAccounts: 'Añade una cuenta abierta antes de crear un pago programado.',
		noBooks: 'Crea un libro antes de planificar pagos programados.',
		noOccurrences: 'Todavía no se han generado ocurrencias.',
		noSchedules: 'Todavía no hay pagos programados. Crea uno para planificar un pago futuro.',
		occurrence: 'Ocurrencia',
		occurrences: 'Ocurrencias',
		one_time: 'Una vez',
		open: 'Ver ocurrencias',
		pause: 'Pausar',
		paused: 'Pausado',
		quarterly: 'Trimestral',
		record: 'Asociar a una transacción',
		recorded: 'Registrada',
		resume: 'Reanudar',
		save: 'Guardar cambios',
		saved: 'Pago programado guardado.',
		scheduleTitle: 'Pagos programados',
		start: 'Fecha inicial',
		status: 'Estado',
		title: 'Planificación de pagos',
		transaction: 'Transacción coincidente',
		transactionMissing: 'Todavía no hay una transacción coincidente.',
		transactionNone: 'Elige una transacción',
		update: 'Editar',
		weekly: 'Semanal',
		yearly: 'Anual',
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
			// The HTTP status is the best available message for a non-JSON error.
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

function minorUnits(value: string, currencyCode: string): number {
	const normalized = value.trim().replace(',', '.');
	const match = /^(?<sign>[+-]?)(?:(?<whole>\d+)(?:\.(?<fraction>\d*))?|\.(?<leadingFraction>\d+))$/u.exec(
		normalized
	);
	if (!match) {
		throw new TypeError('Enter a valid amount.');
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
	const amount =
		(BigInt(groups?.whole ?? '0') * scale + BigInt(fraction.padEnd(digits, '0') || '0')) *
		(groups?.sign === '-' ? -1n : 1n);
	if (amount === 0n || amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new RangeError('Amount is zero or outside the supported range.');
	}

	return Number(amount);
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

function SchedulePlanning(): ReactElement {
	const { language } = useLocale();
	const copy = COPY[language];
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [openScheduleId, setOpenScheduleId] = useState('');
	const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [editingId, setEditingId] = useState('');
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
			setSchedules([]);
			setAccounts([]);

			return;
		}
		const controller = new AbortController();
		setLoading(true);
		setError('');
		const base = `/api/v1/books/${encodeURIComponent(bookId)}`;
		void Promise.all([
			request<unknown>(`${base}/accounts`, { signal: controller.signal }),
			request<unknown>(`${base}/schedules`, { signal: controller.signal }),
		])
			.then(([accountResult, scheduleResult]) => {
				setAccounts(items<Account>(accountResult));
				setSchedules(items<Schedule>(scheduleResult));
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

	async function refreshSchedules(): Promise<void> {
		const result = await request<unknown>(`/api/v1/books/${encodeURIComponent(bookId)}/schedules`);
		setSchedules(items<Schedule>(result));
	}

	async function loadOccurrences(schedule: Schedule): Promise<void> {
		const base = `/api/v1/books/${encodeURIComponent(bookId)}`;
		const [occurrenceResult, transactionResult] = await Promise.all([
			request<unknown>(`${base}/schedules/${encodeURIComponent(schedule.id)}/occurrences`),
			request<unknown>(`${base}/transactions?accountId=${encodeURIComponent(schedule.accountId)}`),
		]);
		setOccurrences(items<Occurrence>(occurrenceResult));
		setTransactions(items<Transaction>(transactionResult));
		setOpenScheduleId(schedule.id);
	}

	async function perform(action: () => Promise<void>): Promise<void> {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			await action();
		} catch (error_) {
			setError(error_ instanceof Error ? error_.message : copy.error);
		} finally {
			setBusy(false);
		}
	}

	async function createSchedule(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!selectedBook) {
			return;
		}
		const form = event.currentTarget;
		const values = new FormData(form);
		const text = (name: string): string => {
			const value = values.get(name);

			return typeof value === 'string' ? value.trim() : '';
		};
		await perform(async () => {
			const frequency = text('frequency') as Frequency;
			const limit = text('occurrenceLimit');
			const interval = frequency === 'one_time' ? 1 : Number(text('interval'));
			const schedulePath = `/api/v1/books/${encodeURIComponent(bookId)}/schedules`;
			const scheduleBody = json('POST', {
				accountId: text('accountId'),
				amountMinor: minorUnits(text('amount'), selectedBook.currencyCode),
				endDate: text('endDate') || undefined,
				frequency,
				interval,
				memo: text('memo'),
				...(limit && { occurrenceLimit: Number(limit) }),
				payee: text('payee'),
				startDate: text('startDate'),
			});
			await request<Schedule>(schedulePath, scheduleBody);
			await refreshSchedules();
			form.reset();
			setNotice(copy.saved);
		});
	}

	async function updateSchedule(event: SubmitEvent<HTMLFormElement>, schedule: Schedule): Promise<void> {
		event.preventDefault();
		if (!selectedBook) {
			return;
		}
		const form = event.currentTarget;
		const values = new FormData(form);
		const text = (name: string): string => {
			const value = values.get(name);

			return typeof value === 'string' ? value.trim() : '';
		};
		await perform(async () => {
			const schedulePath = `/api/v1/books/${encodeURIComponent(bookId)}/schedules/${encodeURIComponent(schedule.id)}`;
			const scheduleBody = json('PATCH', {
				...(text('amount') && { amountMinor: minorUnits(text('amount'), selectedBook.currencyCode) }),
				...(text('endDate') && { endDate: text('endDate') }),
				...(text('memo') !== schedule.memo && { memo: text('memo') }),
				...(text('occurrenceLimit') && { occurrenceLimit: Number(text('occurrenceLimit')) }),
				...(text('payee') !== schedule.payee && { payee: text('payee') }),
			});
			await request<Schedule>(schedulePath, scheduleBody);
			await refreshSchedules();
			setEditingId('');
			setNotice(copy.saved);
		});
	}

	async function changeStatus(schedule: Schedule, status: 'active' | 'canceled' | 'paused'): Promise<void> {
		await perform(async () => {
			const statusPath = `/api/v1/books/${encodeURIComponent(bookId)}/schedules/${encodeURIComponent(schedule.id)}/status`;
			const statusBody = json('PUT', { status });
			await request<Schedule>(statusPath, statusBody);
			await refreshSchedules();
			if (openScheduleId === schedule.id) {
				await loadOccurrences({ ...schedule, status });
			}
			setNotice(status === 'canceled' ? copy.canceledNotice : copy.saved);
		});
	}

	async function generate(schedule: Schedule, event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		const throughDate = values.get('throughDate');
		const maxOccurrences = values.get('maxOccurrences');
		await perform(async () => {
			await request<Occurrence[]>(
				`/api/v1/books/${encodeURIComponent(bookId)}/schedules/${encodeURIComponent(schedule.id)}/occurrences`,
				json('POST', {
					maxOccurrences: typeof maxOccurrences === 'string' && maxOccurrences ? Number(maxOccurrences) : 100,
					throughDate: typeof throughDate === 'string' ? throughDate : '',
				})
			);
			await loadOccurrences(schedule);
			await refreshSchedules();
			setNotice(copy.generateSuccess);
		});
	}

	async function recordOccurrence(
		event: SubmitEvent<HTMLFormElement>,
		occurrence: Occurrence,
		schedule: Schedule
	): Promise<void> {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const transactionId = form.get('transactionId');
		if (typeof transactionId !== 'string' || !transactionId) {
			return;
		}
		await perform(async () => {
			await request<Occurrence>(
				`/api/v1/books/${encodeURIComponent(bookId)}/schedule-occurrences/${encodeURIComponent(occurrence.id)}/record`,
				json('POST', { transactionId })
			);
			await loadOccurrences(schedule);
			setNotice(copy.saved);
		});
	}

	function accountName(id: string): string {
		return accounts.find(account => account.id === id)?.name ?? id;
	}

	function statusLabel(status: ScheduleStatus): string {
		if (status === 'active') {
			return language === 'es' ? 'Activo' : 'Active';
		}
		if (status === 'paused') {
			return copy.paused;
		}
		if (status === 'canceled') {
			return copy.canceled;
		}

		return language === 'es' ? 'Completado' : 'Completed';
	}

	function frequencyLabel(frequency: Frequency): string {
		return copy[frequency];
	}

	return (
		<section
			aria-labelledby='schedule-planning-title'
			className={styles.planning}>
			<header className={styles.header}>
				<div>
					<h2 id='schedule-planning-title'>{copy.title}</h2>
					<p>{copy.scheduleTitle}</p>
				</div>
				{books.length > 1 && (
					<label className={styles.field}>
						{language === 'es' ? 'Libro' : 'Book'}
						<select
							aria-label={language === 'es' ? 'Libro' : 'Book'}
							onChange={event => {
								setBookId(event.currentTarget.value);
								setOpenScheduleId('');
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
						aria-labelledby='schedule-list-title'
						className={styles.surface}>
						<div className={styles.sectionHeading}>
							<h3 id='schedule-list-title'>{copy.scheduleTitle}</h3>
						</div>
						{schedules.length === 0 ? (
							<p className={styles.empty}>{copy.noSchedules}</p>
						) : (
							<ul className={styles.list}>
								{schedules.map(schedule => (
									<li
										className={styles.scheduleRow}
										key={schedule.id}>
										<div className={styles.scheduleInfo}>
											<h4>
												{schedule.payee || schedule.memo || accountName(schedule.accountId)}
											</h4>
											<p>
												{formatMoney(schedule.amountMinor, selectedBook.currencyCode, language)}{' '}
												· {frequencyLabel(schedule.frequency)}
												{schedule.interval > 1 && schedule.frequency !== 'one_time'
													? ` · ${copy.every.toLowerCase()} ${String(schedule.interval)}`
													: ''}
											</p>
											<p>
												{accountName(schedule.accountId)} ·{' '}
												{formatDate(schedule.startDate, language)}
												{schedule.endDate ? ` – ${formatDate(schedule.endDate, language)}` : ''}
											</p>
											{schedule.memo && <p>{schedule.memo}</p>}
										</div>
										<span className={styles.badge}>{statusLabel(schedule.status)}</span>
										<div className={styles.scheduleActions}>
											<button
												className={`${styles.rowButton} ${styles.secondary}`}
												disabled={busy}
												onClick={() => {
													if (openScheduleId === schedule.id) {
														setOpenScheduleId('');

														return;
													}
													void perform(() => loadOccurrences(schedule));
												}}
												type='button'>
												{openScheduleId === schedule.id
													? language === 'es'
														? 'Ocultar ocurrencias'
														: 'Hide occurrences'
													: copy.open}
											</button>
											{schedule.status === 'active' && (
												<button
													className={`${styles.rowButton} ${styles.secondary}`}
													disabled={busy}
													onClick={() => void changeStatus(schedule, 'paused')}
													type='button'>
													{copy.pause}
												</button>
											)}
											{schedule.status === 'paused' && (
												<button
													className={`${styles.rowButton} ${styles.secondary}`}
													disabled={busy}
													onClick={() => void changeStatus(schedule, 'active')}
													type='button'>
													{copy.resume}
												</button>
											)}
											{(schedule.status === 'active' || schedule.status === 'paused') && (
												<button
													className={`${styles.rowButton} ${styles.secondary}`}
													disabled={busy}
													onClick={() => void changeStatus(schedule, 'canceled')}
													type='button'>
													{copy.cancel}
												</button>
											)}
											{schedule.status !== 'canceled' && schedule.status !== 'completed' && (
												<button
													className={`${styles.rowButton} ${styles.secondary}`}
													disabled={busy}
													onClick={() =>
														setEditingId(current =>
															current === schedule.id ? '' : schedule.id
														)
													}
													type='button'>
													{copy.update}
												</button>
											)}
										</div>

										{editingId === schedule.id && (
											<form
												className={styles.form}
												onSubmit={event => void updateSchedule(event, schedule)}>
												<label className={styles.field}>
													{copy.name}
													<input
														defaultValue={schedule.payee}
														maxLength={120}
														name='payee'
													/>
												</label>
												<label className={styles.field}>
													{copy.amount}
													<input
														defaultValue={String(
															schedule.amountMinor /
																10 **
																	(new Intl.NumberFormat('en', {
																		currency: selectedBook.currencyCode,
																		style: 'currency',
																	}).resolvedOptions().maximumFractionDigits ?? 2)
														)}
														inputMode='decimal'
														name='amount'
														type='number'
													/>
												</label>
												<label className={styles.field}>
													{copy.memo}
													<input
														defaultValue={schedule.memo}
														maxLength={500}
														name='memo'
													/>
												</label>
												<label className={styles.field}>
													{copy.end}
													<input
														defaultValue={schedule.endDate ?? ''}
														name='endDate'
														type='date'
													/>
												</label>
												<label className={styles.field}>
													{copy.limit}
													<input
														defaultValue={
															schedule.occurrenceLimit === undefined
																? ''
																: String(schedule.occurrenceLimit)
														}
														min='1'
														name='occurrenceLimit'
														type='number'
													/>
												</label>
												<button
													className={styles.button}
													disabled={busy}
													type='submit'>
													{copy.save}
												</button>
											</form>
										)}

										{openScheduleId === schedule.id && (
											<div className={styles.occurrences}>
												<div className={styles.occurrencesHeader}>
													<h5>{copy.occurrences}</h5>
													{schedule.status === 'active' && (
														<form
															className={styles.inlineForm}
															onSubmit={event => void generate(schedule, event)}>
															<label>
																{copy.dateThrough}
																<input
																	name='throughDate'
																	required
																	type='date'
																/>
															</label>
															<label>
																{copy.limit}
																<input
																	defaultValue='100'
																	max='500'
																	min='1'
																	name='maxOccurrences'
																	required
																	type='number'
																/>
															</label>
															<button
																className={styles.rowButton}
																disabled={busy}
																type='submit'>
																{copy.generate}
															</button>
														</form>
													)}
												</div>
												{occurrences.length === 0 ? (
													<p>{copy.noOccurrences}</p>
												) : (
													<ul className={styles.list}>
														{occurrences.map(occurrence => (
															<li
																className={styles.occurrenceRow}
																key={occurrence.id}>
																<div>
																	<h5>
																		{copy.occurrence}{' '}
																		{String(occurrence.occurrenceNumber + 1)}
																	</h5>
																	<p>
																		{formatDate(occurrence.dueDate, language)} ·{' '}
																		{formatMoney(
																			occurrence.amountMinor,
																			selectedBook.currencyCode,
																			language
																		)}{' '}
																		·{' '}
																		{occurrence.payee ||
																			accountName(occurrence.accountId)}
																	</p>
																</div>
																<span className={styles.badge}>
																	{occurrence.status === 'pending'
																		? language === 'es'
																			? 'Pendiente'
																			: 'Pending'
																		: occurrence.status === 'recorded'
																			? copy.recorded
																			: language === 'es'
																				? 'Omitida'
																				: 'Skipped'}
																</span>
																{occurrence.status === 'pending' && (
																	<form
																		className={styles.inlineForm}
																		onSubmit={event =>
																			void recordOccurrence(
																				event,
																				occurrence,
																				schedule
																			)
																		}>
																		{transactions.filter(
																			transaction =>
																				transaction.accountId ===
																					occurrence.accountId &&
																				transaction.amountMinor ===
																					occurrence.amountMinor
																		).length === 0 ? (
																			<span>{copy.transactionMissing}</span>
																		) : (
																			<>
																				<label>
																					{copy.transaction}
																					<select
																						aria-label={copy.transaction}
																						name='transactionId'
																						required>
																						<option value=''>
																							{copy.transactionNone}
																						</option>
																						{transactions
																							.filter(
																								transaction =>
																									transaction.accountId ===
																										occurrence.accountId &&
																									transaction.amountMinor ===
																										occurrence.amountMinor
																							)
																							.map(transaction => (
																								<option
																									key={transaction.id}
																									value={
																										transaction.id
																									}>
																									{formatDate(
																										transaction.transactionDate,
																										language
																									)}{' '}
																									·{' '}
																									{transaction.payee ||
																										transaction.id}
																								</option>
																							))}
																					</select>
																				</label>
																				<button
																					className={styles.rowButton}
																					disabled={busy}
																					type='submit'>
																					{copy.record}
																				</button>
																			</>
																		)}
																	</form>
																)}
															</li>
														))}
													</ul>
												)}
											</div>
										)}
									</li>
								))}
							</ul>
						)}
					</section>

					<section
						aria-labelledby='schedule-create-title'
						className={styles.surface}>
						<div className={styles.sectionHeading}>
							<h3 id='schedule-create-title'>{copy.create}</h3>
						</div>
						{activeAccounts.length === 0 && <p className={styles.empty}>{copy.noAccounts}</p>}
						<form
							className={styles.form}
							onSubmit={event => void createSchedule(event)}>
							<label className={styles.field}>
								{copy.name}
								<input
									maxLength={120}
									name='payee'
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
										{language === 'es' ? 'Elige una cuenta' : 'Choose an account'}
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
								{copy.amount}
								<input
									inputMode='decimal'
									name='amount'
									required
									step='any'
									type='number'
								/>
							</label>
							<label className={styles.field}>
								{copy.frequency}
								<select
									defaultValue='monthly'
									name='frequency'>
									{(['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map(
										frequency => (
											<option
												key={frequency}
												value={frequency}>
												{frequencyLabel(frequency)}
											</option>
										)
									)}
								</select>
							</label>
							<label className={styles.field}>
								{copy.every}
								<input
									defaultValue='1'
									min='1'
									name='interval'
									required
									type='number'
								/>
							</label>
							<label className={styles.field}>
								{copy.start}
								<input
									name='startDate'
									required
									type='date'
								/>
							</label>
							<label className={styles.field}>
								{copy.end}
								<input
									name='endDate'
									type='date'
								/>
							</label>
							<label className={styles.field}>
								{copy.limit}
								<input
									min='1'
									name='occurrenceLimit'
									type='number'
								/>
							</label>
							<label className={styles.field}>
								{copy.memo}
								<input
									maxLength={500}
									name='memo'
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

export { SchedulePlanning };
