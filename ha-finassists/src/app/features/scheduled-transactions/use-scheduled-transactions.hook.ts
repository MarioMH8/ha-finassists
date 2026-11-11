import type { Category } from '@app/features/categories/categories-api';
import { fetchCategories } from '@app/features/categories/categories-api';
import { currencyFractionDigits } from '@app/features/transactions/transaction-amount';
import { todayIsoDate } from '@app/features/transactions/transaction-dates';
import type { TransactionKind } from '@app/features/transactions/transactions-api';
import { TRANSACTION_KIND } from '@app/features/transactions/transactions-api';
import type { LoadState } from '@app/features/transactions/transactions-constants';
import { LOAD_STATE } from '@app/features/transactions/transactions-constants';
import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import { useFeatureFlags } from '@app/shell/feature-flags-context';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ScheduledTransactionFormErrors } from './scheduled-transaction-validation';
import { validateScheduledTransactionForm } from './scheduled-transaction-validation';
import type {
	ScheduledForecast,
	ScheduledTransaction,
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
} from './scheduled-transactions-api';
import {
	createScheduledTransaction,
	deleteScheduledTransaction,
	fetchAllScheduledTransactions,
	fetchScheduledForecast,
	postScheduledTransaction,
	SCHEDULED_TRANSACTION_FREQUENCY,
	SCHEDULED_TRANSACTION_POSTING_MODE,
	SCHEDULED_TRANSACTION_STATUS,
	skipScheduledTransaction,
	updateScheduledTransaction,
} from './scheduled-transactions-api';

interface Feedback {
	message: string;
	tone: 'error' | 'success';
}

interface ScheduledTransactionsState {
	amount: string;
	amountReference: RefObject<HTMLInputElement | null>;
	busyScheduleId: string | undefined;
	cancelDelete: () => void;
	categories: Category[];
	categoryId: string;
	closeEditor: () => void;
	confirmingScheduleId: string | undefined;
	copy: Copy;
	currencyCode: string;
	deleteSchedule: (schedule: ScheduledTransaction) => Promise<void>;
	deletingScheduleId: string | undefined;
	description: string;
	editingScheduleId: string | undefined;
	endDate: string;
	errors: ScheduledTransactionFormErrors;
	feedback: Feedback | undefined;
	forecast: ScheduledForecast | undefined;
	forecastState: LoadState;
	frequency: ScheduledTransactionFrequency;
	interval: string;
	isEditorOpen: boolean;
	isSubmitting: boolean;
	kind: TransactionKind;
	language: Language;
	listState: LoadState;
	openCreate: () => void;
	openEdit: (schedule: ScheduledTransaction) => void;
	pauseSchedule: (schedule: ScheduledTransaction) => Promise<void>;
	pendingSchedules: ScheduledTransaction[];
	postSchedule: (schedule: ScheduledTransaction) => Promise<void>;
	postingMode: ScheduledTransactionPostingMode;
	resumeSchedule: (schedule: ScheduledTransaction) => Promise<void>;
	schedules: ScheduledTransaction[];
	setAmount: (event: ChangeEvent<HTMLInputElement>) => void;
	setCategoryId: (categoryId: string) => void;
	setConfirmingScheduleId: Dispatch<SetStateAction<string | undefined>>;
	setDescription: (event: ChangeEvent<HTMLInputElement>) => void;
	setEndDate: (event: ChangeEvent<HTMLInputElement>) => void;
	setFrequency: (frequency: ScheduledTransactionFrequency) => void;
	setInterval: (event: ChangeEvent<HTMLInputElement>) => void;
	setKind: (kind: TransactionKind) => void;
	setPostingMode: (postingMode: ScheduledTransactionPostingMode) => void;
	setStartDate: (event: ChangeEvent<HTMLInputElement>) => void;
	skipSchedule: (schedule: ScheduledTransaction) => Promise<void>;
	startDate: string;
	submit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	today: string;
}

function amountInputValue(schedule: ScheduledTransaction, currencyCode: string, language: Language): string {
	const digits = currencyFractionDigits(currencyCode);

	return new Intl.NumberFormat(language, {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
		useGrouping: false,
	}).format(schedule.amountMinor / 10 ** digits);
}

function useScheduledTransactions(currencyCode: string): ScheduledTransactionsState {
	const { copy, language } = useLocale();
	const { capabilities, ui } = useFeatureFlags();
	const [schedules, setSchedules] = useState<ScheduledTransaction[]>([]);
	const [today, setToday] = useState(todayIsoDate());
	const [listState, setListState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [forecast, setForecast] = useState<ScheduledForecast | undefined>(undefined);
	const [forecastState, setForecastState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [categories, setCategories] = useState<Category[]>([]);
	const [kind, setKindValue] = useState<TransactionKind>(TRANSACTION_KIND.EXPENSE);
	const [amount, setAmountValue] = useState('');
	const [startDate, setStartDateValue] = useState('');
	const [endDate, setEndDateValue] = useState('');
	const [frequency, setFrequencyValue] = useState<ScheduledTransactionFrequency>(
		SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY
	);
	const [interval, setIntervalValue] = useState('1');
	const [postingMode, setPostingModeValue] = useState<ScheduledTransactionPostingMode>(
		SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC
	);
	const [description, setDescriptionValue] = useState('');
	const [categoryId, setCategoryIdValue] = useState('');
	const [errors, setErrors] = useState<ScheduledTransactionFormErrors>({});
	const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingScheduleId, setEditingScheduleId] = useState<string | undefined>(undefined);
	const [confirmingScheduleId, setConfirmingScheduleId] = useState<string | undefined>(undefined);
	const [deletingScheduleId, setDeletingScheduleId] = useState<string | undefined>(undefined);
	const [busyScheduleId, setBusyScheduleId] = useState<string | undefined>(undefined);
	const amountReference = useRef<HTMLInputElement>(null);
	const listGeneration = useRef(0);
	const forecastGeneration = useRef(0);

	useEffect(() => {
		// The default date depends on the browser clock, so it is set after hydration.
		setStartDateValue(current => current || todayIsoDate());
		const controller = new AbortController();
		void loadSchedules(controller.signal);
		if (ui.scheduledSummary) {
			void loadForecast(controller.signal);
		}
		if (capabilities.categories) {
			void loadCategories(controller.signal);
		}

		return () => controller.abort();
	}, [capabilities.categories, ui.scheduledSummary]);

	async function loadSchedules(signal?: AbortSignal): Promise<void> {
		const generation = ++listGeneration.current;
		setListState(LOAD_STATE.LOADING);
		try {
			const result = await fetchAllScheduledTransactions({}, signal);
			if (generation === listGeneration.current) {
				setSchedules(result.items);
				setToday(result.today);
				setListState(LOAD_STATE.READY);
			}
		} catch {
			if (generation === listGeneration.current && !signal?.aborted) {
				setListState(LOAD_STATE.ERROR);
			}
		}
	}

	async function loadForecast(signal?: AbortSignal): Promise<void> {
		const generation = ++forecastGeneration.current;
		setForecastState(LOAD_STATE.LOADING);
		try {
			const result = await fetchScheduledForecast({}, signal);
			if (generation === forecastGeneration.current) {
				setForecast(result);
				setForecastState(LOAD_STATE.READY);
			}
		} catch {
			if (generation === forecastGeneration.current && !signal?.aborted) {
				setForecastState(LOAD_STATE.ERROR);
			}
		}
	}

	async function loadCategories(signal?: AbortSignal): Promise<void> {
		try {
			const items = await fetchCategories(undefined, signal);
			if (!signal?.aborted) {
				setCategories(items);
			}
		} catch {
			// The selector degrades to "no category" when the list cannot be loaded.
		}
	}

	async function refresh(): Promise<void> {
		await Promise.all([loadSchedules(), ...(ui.scheduledSummary ? [loadForecast()] : [])]);
	}

	function openCreate(): void {
		setEditingScheduleId(undefined);
		setAmountValue('');
		setStartDateValue(todayIsoDate());
		setEndDateValue('');
		setFrequencyValue(SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY);
		setIntervalValue('1');
		setPostingModeValue(SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC);
		setDescriptionValue('');
		setCategoryIdValue('');
		setKindValue(TRANSACTION_KIND.EXPENSE);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function openEdit(schedule: ScheduledTransaction): void {
		setEditingScheduleId(schedule.id);
		setAmountValue(amountInputValue(schedule, currencyCode, language));
		setStartDateValue(schedule.startDate);
		setEndDateValue(schedule.endDate ?? '');
		setFrequencyValue(schedule.frequency);
		setIntervalValue(String(schedule.interval));
		setPostingModeValue(schedule.postingMode);
		setDescriptionValue(schedule.description);
		setCategoryIdValue(schedule.categoryId ?? '');
		setKindValue(schedule.kind);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function closeEditor(): void {
		setIsEditorOpen(false);
		setEditingScheduleId(undefined);
		setErrors({});
		setFeedback(undefined);
	}

	function changeKind(nextKind: TransactionKind): void {
		setKindValue(nextKind);
		if (!capabilities.categories) {
			setCategoryIdValue('');

			return;
		}
		setCategoryIdValue(current => {
			const category = categories.find(item => item.id === current);

			return category === undefined || category.kind === nextKind ? current : '';
		});
	}

	function changeFrequency(nextFrequency: ScheduledTransactionFrequency): void {
		setFrequencyValue(nextFrequency);
		if (nextFrequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE) {
			setIntervalValue('1');
			setEndDateValue('');
		}
	}

	async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (isSubmitting) {
			return;
		}
		const validation = validateScheduledTransactionForm(
			{ amount, categoryId, date: startDate, description, endDate, frequency, interval, kind, postingMode },
			currencyCode
		);
		setFeedback(undefined);
		if (validation.errors) {
			setErrors(validation.errors);
			if (validation.errors.amount) {
				amountReference.current?.focus();
			}

			return;
		}
		setErrors({});
		setIsSubmitting(true);
		try {
			if (editingScheduleId === undefined) {
				await createScheduledTransaction(validation.transaction);
				setFeedback({ message: copy.scheduledCreated, tone: 'success' });
			} else {
				await updateScheduledTransaction(editingScheduleId, validation.transaction);
				setFeedback({ message: copy.scheduledUpdated, tone: 'success' });
			}
			setIsEditorOpen(false);
			setEditingScheduleId(undefined);
			await refresh();
		} catch {
			setFeedback({
				message: editingScheduleId === undefined ? copy.scheduledCreateError : copy.scheduledUpdateError,
				tone: 'error',
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	async function postSchedule(schedule: ScheduledTransaction): Promise<void> {
		setBusyScheduleId(schedule.id);
		try {
			await postScheduledTransaction(schedule.id);
			setFeedback({ message: copy.scheduledPosted, tone: 'success' });
			await refresh();
		} catch {
			setFeedback({ message: copy.scheduledPostError, tone: 'error' });
		} finally {
			setBusyScheduleId(undefined);
		}
	}

	async function skipSchedule(schedule: ScheduledTransaction): Promise<void> {
		setBusyScheduleId(schedule.id);
		try {
			await skipScheduledTransaction(schedule.id);
			setFeedback({ message: copy.scheduledSkipped, tone: 'success' });
			await refresh();
		} catch {
			setFeedback({ message: copy.scheduledSkipError, tone: 'error' });
		} finally {
			setBusyScheduleId(undefined);
		}
	}

	async function pauseSchedule(schedule: ScheduledTransaction): Promise<void> {
		setBusyScheduleId(schedule.id);
		try {
			await updateScheduledTransaction(schedule.id, { status: 'paused' });
			setFeedback({ message: copy.scheduledPaused, tone: 'success' });
			await refresh();
		} catch {
			setFeedback({ message: copy.scheduledPauseError, tone: 'error' });
		} finally {
			setBusyScheduleId(undefined);
		}
	}

	async function resumeSchedule(schedule: ScheduledTransaction): Promise<void> {
		setBusyScheduleId(schedule.id);
		try {
			await updateScheduledTransaction(schedule.id, { status: 'active' });
			setFeedback({ message: copy.scheduledResumed, tone: 'success' });
			await refresh();
		} catch {
			setFeedback({ message: copy.scheduledResumeError, tone: 'error' });
		} finally {
			setBusyScheduleId(undefined);
		}
	}

	async function deleteSchedule(schedule: ScheduledTransaction): Promise<void> {
		setDeletingScheduleId(schedule.id);
		try {
			await deleteScheduledTransaction(schedule.id);
			setConfirmingScheduleId(undefined);
			setFeedback({ message: copy.scheduledDeleted, tone: 'success' });
			await refresh();
		} catch {
			setConfirmingScheduleId(undefined);
			setFeedback({ message: copy.scheduledDeleteError, tone: 'error' });
		} finally {
			setDeletingScheduleId(undefined);
		}
	}

	function cancelDelete(): void {
		setConfirmingScheduleId(undefined);
	}

	const visibleSchedules = schedules.filter(schedule => schedule.status !== SCHEDULED_TRANSACTION_STATUS.COMPLETED);
	const pendingSchedules = visibleSchedules.filter(
		schedule =>
			schedule.status === SCHEDULED_TRANSACTION_STATUS.ACTIVE &&
			schedule.postingMode === SCHEDULED_TRANSACTION_POSTING_MODE.MANUAL &&
			schedule.nextDueDate !== null &&
			schedule.nextDueDate <= today
	);

	return {
		amount,
		amountReference,
		busyScheduleId,
		cancelDelete,
		categories,
		categoryId,
		closeEditor,
		confirmingScheduleId,
		copy,
		currencyCode,
		deleteSchedule,
		deletingScheduleId,
		description,
		editingScheduleId,
		endDate,
		errors,
		feedback,
		forecast,
		forecastState,
		frequency,
		interval,
		isEditorOpen,
		isSubmitting,
		kind,
		language,
		listState,
		openCreate,
		openEdit,
		pauseSchedule,
		pendingSchedules,
		postingMode,
		postSchedule,
		resumeSchedule,
		schedules: visibleSchedules,
		setAmount: event => {
			setAmountValue(event.currentTarget.value);
		},
		setCategoryId: setCategoryIdValue,
		setConfirmingScheduleId,
		setDescription: event => {
			setDescriptionValue(event.currentTarget.value);
		},
		setEndDate: event => {
			setEndDateValue(event.currentTarget.value);
		},
		setFrequency: changeFrequency,
		setInterval: event => {
			setIntervalValue(event.currentTarget.value);
		},
		setKind: changeKind,
		setPostingMode: setPostingModeValue,
		setStartDate: event => {
			setStartDateValue(event.currentTarget.value);
		},
		skipSchedule,
		startDate,
		submit,
		today,
	};
}

export { type ScheduledTransactionsState, useScheduledTransactions };
