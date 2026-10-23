import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement, SubmitEvent } from 'react';
import { useEffect, useState } from 'react';

import { ParticipantsPanel } from './participants-panel';
import { SharedExpenseList } from './shared-expense-list';
import styles from './shared-expenses.module.css';
import { getSharedExpensesCopy } from './shared-expenses-copy';
import type { CreateExpenseInput, CreateParticipantInput, Participant, SharedExpense } from './shared-expenses-model';
import {
	formatMinorUnits,
	json,
	loadAllPageItems,
	parseAmount,
	request,
	sharedExpensePath,
} from './shared-expenses-model';

const SECTION = {
	EXPENSES: 'expenses',
	PEOPLE: 'people',
} as const;

const EXPENSE_ACTION = {
	CLOSE: 'close',
	REOPEN: 'reopen',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];
type ExpenseAction = (typeof EXPENSE_ACTION)[keyof typeof EXPENSE_ACTION];

interface SharedExpensesManagementProps {
	bookId: string;
	currencyCode: string;
}

interface SharedExpenseData {
	expenses: SharedExpense[];
	participants: Participant[];
}

function formString(values: FormData, key: string): string {
	const value = values.get(key);

	return typeof value === 'string' ? value : '';
}

async function loadSharedExpensesData(
	bookId: string,
	shouldIncludeClosed: boolean,
	shouldIncludeRemoved: boolean,
	signal?: AbortSignal
): Promise<SharedExpenseData> {
	const expensePath = `${sharedExpensePath(bookId, 'shared-expenses')}?includeClosed=${String(shouldIncludeClosed)}`;
	const participantPath = `${sharedExpensePath(bookId, 'shared-expense-participants')}?includeRemoved=${String(shouldIncludeRemoved)}`;
	const [expenses, participants] = await Promise.all([
		loadAllPageItems<SharedExpense>(expensePath, signal),
		loadAllPageItems<Participant>(participantPath, signal),
	]);

	return { expenses, participants };
}

function SharedExpensesManagement({ bookId, currencyCode }: SharedExpensesManagementProps): ReactElement {
	const { language } = useLocale();
	const copy = getSharedExpensesCopy(language);
	const [section, setSection] = useState<Section>(SECTION.EXPENSES);
	const [expenses, setExpenses] = useState<SharedExpense[]>([]);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [showClosed, setShowClosed] = useState(false);
	const [showRemoved, setShowRemoved] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(Boolean(bookId));
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const activeParticipants = participants.filter(participant => participant.removedAt === undefined);

	useEffect(() => {
		if (!bookId) {
			setExpenses([]);
			setParticipants([]);
			setLoading(false);

			return;
		}
		const controller = new AbortController();
		setLoading(true);
		setError('');
		void loadSharedExpensesData(bookId, showClosed, showRemoved, controller.signal)
			.then(data => {
				setExpenses(data.expenses);
				setParticipants(data.participants);
			})
			.catch((error_: unknown) => {
				if (!controller.signal.aborted) {
					setError(error_ instanceof Error ? error_.message : copy.loadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, [bookId, showClosed, showRemoved, copy.loadError]);

	async function isActionSuccessful(action: () => Promise<void>, message?: string): Promise<boolean> {
		setBusy(true);
		setError('');
		setNotice('');
		try {
			await action();
			if (message) {
				setNotice(message);
			}

			return true;
		} catch (error_: unknown) {
			setError(error_ instanceof Error ? error_.message : copy.loadError);

			return false;
		} finally {
			setBusy(false);
		}
	}

	async function refresh(): Promise<void> {
		if (!bookId) {
			return;
		}
		const data = await loadSharedExpensesData(bookId, showClosed, showRemoved);
		setExpenses(data.expenses);
		setParticipants(data.participants);
	}

	async function submitExpense(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		const description = formString(values, 'description').trim();
		const participantIds = values
			.getAll('participantIds')
			.filter((value): value is string => typeof value === 'string');
		let amountMinor: number;
		try {
			amountMinor = parseAmount(formString(values, 'amount'), currencyCode);
		} catch {
			setError(copy.validationAmount);

			return;
		}
		if (!description || description.length > 200) {
			setError(copy.validationDescription);

			return;
		}
		if (participantIds.length === 0) {
			setError(copy.validationParticipants);

			return;
		}

		const input: CreateExpenseInput = { amountMinor, description, participantIds };
		const wasCreated = await isActionSuccessful(async () => {
			await request<SharedExpense>(sharedExpensePath(bookId, 'shared-expenses'), json('POST', input));
			await refresh();
		}, copy.created);
		if (wasCreated) {
			form.reset();
		}
	}

	async function isParticipantCreated(input: CreateParticipantInput): Promise<boolean> {
		if (!bookId || input.id.length > 120 || input.name.length > 120) {
			setError(copy.validationParticipant);

			return false;
		}

		return isActionSuccessful(async () => {
			await request<Participant>(sharedExpensePath(bookId, 'shared-expense-participants'), json('POST', input));
			await refresh();
		}, copy.participantAdded);
	}

	async function isParticipantRemovalSuccessful(participantId: string): Promise<boolean> {
		return isActionSuccessful(async () => {
			await request<undefined>(
				`${sharedExpensePath(bookId, 'shared-expense-participants')}/${encodeURIComponent(participantId)}/remove`,
				json('POST')
			);
			await refresh();
		}, copy.notice);
	}

	function changeExpenseState(expenseId: string, action: ExpenseAction): void {
		void isActionSuccessful(async () => {
			await request<undefined>(
				`${sharedExpensePath(bookId, 'shared-expenses')}/${encodeURIComponent(expenseId)}/${action}`,
				json('POST')
			);
			await refresh();
		}, copy.notice);
	}

	function settle(expenseId: string, participantId: string): void {
		void isActionSuccessful(async () => {
			await request<undefined>(
				`${sharedExpensePath(bookId, 'shared-expenses')}/${encodeURIComponent(expenseId)}/settle`,
				json('POST', { participantId })
			);
			await refresh();
		}, copy.notice);
	}

	return (
		<div className={styles.management}>
			<header className={styles.header}>
				<div className={styles['header-copy']}>
					<h2>{copy.expenses}</h2>
					<p>{copy.intro}</p>
				</div>
				<button
					className={styles.secondary}
					disabled={busy || loading || !bookId}
					onClick={() => void isActionSuccessful(refresh)}
					type='button'>
					{copy.refresh}
				</button>
			</header>
			<p className={styles.subtitle}>{copy.subtitle}</p>

			<div
				aria-live='polite'
				className={styles['live-messages']}>
				{loading && <p role='status'>{copy.loading}</p>}
				{error && (
					<p
						className={styles.error}
						role='alert'>
						{error}
					</p>
				)}
				{notice && (
					<p
						className={styles.success}
						role='status'>
						{notice}
					</p>
				)}
			</div>

			<nav
				aria-label={copy.tabLabel}
				className={styles.navigation}>
				<button
					aria-pressed={section === SECTION.EXPENSES}
					className={section === SECTION.EXPENSES ? styles['nav-active'] : styles['nav-item']}
					onClick={() => setSection(SECTION.EXPENSES)}
					type='button'>
					{copy.expenses}
				</button>
				<button
					aria-pressed={section === SECTION.PEOPLE}
					className={section === SECTION.PEOPLE ? styles['nav-active'] : styles['nav-item']}
					onClick={() => setSection(SECTION.PEOPLE)}
					type='button'>
					{copy.people}
					<span className={styles['nav-count']}>{activeParticipants.length}</span>
				</button>
			</nav>

			{section === SECTION.EXPENSES ? (
				<div className={styles['expense-layout']}>
					<section
						aria-labelledby='shared-expense-create-title'
						className={styles.panel}>
						<div className={styles['section-heading']}>
							<h3 id='shared-expense-create-title'>{copy.addExpense}</h3>
							<p>{copy.shareEqual}</p>
						</div>
						<form
							className={styles['expense-form']}
							onSubmit={event => void submitExpense(event)}>
							<label>
								{copy.description}
								<input
									autoComplete='off'
									maxLength={200}
									name='description'
									placeholder={copy.descriptionPlaceholder}
									required
								/>
							</label>
							<label>
								{copy.amount}
								<span className={styles['input-with-unit']}>
									<input
										aria-describedby='shared-expense-amount-hint'
										inputMode='decimal'
										name='amount'
										placeholder={currencyCode === 'JPY' ? '1200' : '12.50'}
										required
										type='text'
									/>
									<span aria-hidden='true'>{currencyCode}</span>
								</span>
								<span
									className={styles.hint}
									id='shared-expense-amount-hint'>
									{copy.amountHint}
								</span>
							</label>
							<fieldset className={styles['participant-fieldset']}>
								<legend>{copy.participants}</legend>
								<p>{copy.participantsHint}</p>
								{activeParticipants.length === 0 ? (
									<p className={styles.empty}>{copy.noParticipants}</p>
								) : (
									<ul className={styles['participant-options']}>
										{activeParticipants.map(participant => (
											<li key={participant.id}>
												<label>
													<input
														name='participantIds'
														type='checkbox'
														value={participant.id}
													/>
													<span>{participant.name}</span>
												</label>
											</li>
										))}
									</ul>
								)}
							</fieldset>
							<button
								aria-busy={busy}
								disabled={busy || loading || activeParticipants.length === 0}
								type='submit'>
								{copy.addExpense}
							</button>
						</form>
						<p className={styles['actor-note']}>
							<span>{copy.actor}</span> · {copy.actorHint}
						</p>
					</section>

					<section
						aria-labelledby='shared-expense-list-title'
						className={styles.panel}>
						<div className={styles['section-heading']}>
							<div>
								<h3 id='shared-expense-list-title'>{copy.expenses}</h3>
								<p>
									{expenses.length} · {copy.total}{' '}
									{formatMinorUnits(
										expenses.reduce((sum, expense) => sum + expense.amountMinor, 0),
										currencyCode,
										language
									)}
								</p>
							</div>
							<label className={styles['toggle-label']}>
								<input
									checked={showClosed}
									onChange={event => setShowClosed(event.currentTarget.checked)}
									type='checkbox'
								/>
								{copy.includeClosed}
							</label>
						</div>
						<p className={styles['actor-note']}>{copy.settlementHint}</p>
						<SharedExpenseList
							busy={busy}
							copy={copy}
							currencyCode={currencyCode}
							expenses={expenses}
							language={language}
							onClose={expenseId => changeExpenseState(expenseId, EXPENSE_ACTION.CLOSE)}
							onReopen={expenseId => changeExpenseState(expenseId, EXPENSE_ACTION.REOPEN)}
							onSettle={settle}
						/>
					</section>
				</div>
			) : (
				<ParticipantsPanel
					busy={busy}
					copy={copy}
					includeRemoved={showRemoved}
					onCreate={isParticipantCreated}
					onRemove={isParticipantRemovalSuccessful}
					participants={participants}
					setIncludeRemoved={setShowRemoved}
				/>
			)}
		</div>
	);
}

export { SharedExpensesManagement, type SharedExpensesManagementProps };
