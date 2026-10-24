import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { currentMonthRange, todayIsoDate } from './transaction-dates';
import type { TransactionFormErrors } from './transaction-validation';
import { validateTransactionForm } from './transaction-validation';
import type { Transaction, TransactionKind, TransactionTotals } from './transactions-api';
import {
	createTransaction,
	deleteTransaction,
	fetchAllTransactions,
	fetchTransactionPage,
	summarizeTransactions,
	TRANSACTION_KIND,
} from './transactions-api';

const PAGE_SIZE = 20;

const LOAD_STATE = {
	ERROR: 'error',
	LOADING: 'loading',
	READY: 'ready',
} as const;

type LoadState = (typeof LOAD_STATE)[keyof typeof LOAD_STATE];

interface Feedback {
	message: string;
	tone: 'error' | 'success';
}

interface TransactionsState {
	amount: string;
	amountReference: RefObject<HTMLInputElement | null>;
	cancelDelete: (transactionId: string) => void;
	confirmationReference: RefObject<HTMLButtonElement | null>;
	confirmingTransactionId: string | undefined;
	copy: Copy;
	currencyCode: string;
	date: string;
	deleteTransaction: (transaction: Transaction) => Promise<void>;
	deletingTransactionId: string | undefined;
	description: string;
	errors: TransactionFormErrors;
	feedback: Feedback | undefined;
	hasMore: boolean;
	isLoadingMore: boolean;
	isSubmitting: boolean;
	kind: TransactionKind;
	language: Language;
	listReference: RefObject<HTMLTableSectionElement | null>;
	listState: LoadState;
	loadMore: () => Promise<void>;
	setAmount: (event: ChangeEvent<HTMLInputElement>) => void;
	setConfirmingTransactionId: Dispatch<SetStateAction<string | undefined>>;
	setDate: (event: ChangeEvent<HTMLInputElement>) => void;
	setDescription: (event: ChangeEvent<HTMLInputElement>) => void;
	setKind: (kind: TransactionKind) => void;
	submit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	summaryState: LoadState;
	total: number;
	totals: TransactionTotals | undefined;
	transactions: Transaction[];
}

function appendUnique(current: Transaction[], incoming: Transaction[]): Transaction[] {
	const known = new Set(current.map(transaction => transaction.id));

	return [...current, ...incoming.filter(transaction => !known.has(transaction.id))];
}

function useTransactions(currencyCode: string): TransactionsState {
	const { copy, language } = useLocale();
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [total, setTotal] = useState(0);
	const [listState, setListState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [totals, setTotals] = useState<TransactionTotals | undefined>(undefined);
	const [summaryState, setSummaryState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [kind, setKind] = useState<TransactionKind>(TRANSACTION_KIND.EXPENSE);
	const [amount, setAmountValue] = useState('');
	const [date, setDateValue] = useState('');
	const [description, setDescriptionValue] = useState('');
	const [errors, setErrors] = useState<TransactionFormErrors>({});
	const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [confirmingTransactionId, setConfirmingTransactionId] = useState<string | undefined>(undefined);
	const [deletingTransactionId, setDeletingTransactionId] = useState<string | undefined>(undefined);
	const [focusAfterRemoval, setFocusAfterRemoval] = useState<number | undefined>(undefined);
	const [focusDeleteTransactionId, setFocusDeleteTransactionId] = useState<string | undefined>(undefined);
	const amountReference = useRef<HTMLInputElement>(null);
	const confirmationReference = useRef<HTMLButtonElement>(null);
	const listReference = useRef<HTMLTableSectionElement>(null);
	const listGeneration = useRef(0);
	const summaryGeneration = useRef(0);

	useEffect(() => {
		// The default date depends on the browser clock, so it is set after hydration.
		setDateValue(current => current || todayIsoDate());
		const controller = new AbortController();
		void loadList(controller.signal);
		void loadSummary(controller.signal);

		return () => controller.abort();
	}, []);

	useEffect(() => {
		if (confirmingTransactionId) {
			confirmationReference.current?.focus();
		}
	}, [confirmingTransactionId]);

	useEffect(() => {
		if (focusAfterRemoval !== undefined) {
			const buttons = listReference.current?.querySelectorAll<HTMLButtonElement>('[data-variant="danger"]');
			const lastIndex = Math.max(0, (buttons?.length ?? 1) - 1);
			(buttons?.[Math.min(focusAfterRemoval, lastIndex)] ?? amountReference.current)?.focus();
			setFocusAfterRemoval(undefined);
		}
		if (focusDeleteTransactionId) {
			listReference.current
				?.querySelector<HTMLButtonElement>(`[data-transaction-id="${CSS.escape(focusDeleteTransactionId)}"]`)
				?.focus();
			setFocusDeleteTransactionId(undefined);
		}
	}, [focusAfterRemoval, focusDeleteTransactionId, transactions]);

	async function loadList(signal?: AbortSignal): Promise<void> {
		const generation = ++listGeneration.current;
		setListState(LOAD_STATE.LOADING);
		try {
			const page = await fetchTransactionPage({ limit: PAGE_SIZE, offset: 0 }, signal);
			if (generation === listGeneration.current) {
				setTransactions(page.items);
				setTotal(page.total);
				setListState(LOAD_STATE.READY);
			}
		} catch {
			if (generation === listGeneration.current && !signal?.aborted) {
				setListState(LOAD_STATE.ERROR);
			}
		}
	}

	async function loadSummary(signal?: AbortSignal): Promise<void> {
		const generation = ++summaryGeneration.current;
		setSummaryState(LOAD_STATE.LOADING);
		try {
			const monthTransactions = await fetchAllTransactions(currentMonthRange(), signal);
			if (generation === summaryGeneration.current) {
				setTotals(summarizeTransactions(monthTransactions, currencyCode));
				setSummaryState(LOAD_STATE.READY);
			}
		} catch {
			if (generation === summaryGeneration.current && !signal?.aborted) {
				setSummaryState(LOAD_STATE.ERROR);
			}
		}
	}

	async function refresh(): Promise<void> {
		await Promise.all([loadList(), loadSummary()]);
	}

	async function loadMore(): Promise<void> {
		if (isLoadingMore) {
			return;
		}
		const generation = listGeneration.current;
		setIsLoadingMore(true);
		try {
			const page = await fetchTransactionPage({ limit: PAGE_SIZE, offset: transactions.length });
			if (generation === listGeneration.current) {
				setTransactions(current => appendUnique(current, page.items));
				setTotal(page.total);
			}
		} catch {
			if (generation === listGeneration.current) {
				setFeedback({ message: copy.transactionLoadError, tone: 'error' });
			}
		} finally {
			setIsLoadingMore(false);
		}
	}

	async function removeTransaction(transaction: Transaction): Promise<void> {
		const index = transactions.findIndex(existing => existing.id === transaction.id);
		setDeletingTransactionId(transaction.id);
		try {
			await deleteTransaction(transaction.id);
			listGeneration.current += 1;
			setTransactions(current => current.filter(existing => existing.id !== transaction.id));
			setTotal(current => Math.max(0, current - 1));
			setConfirmingTransactionId(undefined);
			setFeedback({ message: copy.transactionDeleted, tone: 'success' });
			setFocusAfterRemoval(index);
			await loadSummary();
		} catch {
			setConfirmingTransactionId(undefined);
			setFocusDeleteTransactionId(transaction.id);
			setFeedback({ message: copy.transactionDeleteError, tone: 'error' });
		} finally {
			setDeletingTransactionId(undefined);
		}
	}

	function cancelDelete(transactionId: string): void {
		setConfirmingTransactionId(undefined);
		setFocusDeleteTransactionId(transactionId);
	}

	async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (isSubmitting) {
			return;
		}
		const validation = validateTransactionForm({ amount, date, description, kind }, currencyCode);
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
			await createTransaction(validation.transaction);
			setAmountValue('');
			setDescriptionValue('');
			setDateValue(todayIsoDate());
			setFeedback({ message: copy.transactionCreated, tone: 'success' });
			amountReference.current?.focus();
			await refresh();
		} catch {
			setFeedback({ message: copy.transactionCreateError, tone: 'error' });
		} finally {
			setIsSubmitting(false);
		}
	}

	return {
		amount,
		amountReference,
		cancelDelete,
		confirmationReference,
		confirmingTransactionId,
		copy,
		currencyCode,
		date,
		deleteTransaction: removeTransaction,
		deletingTransactionId,
		description,
		errors,
		feedback,
		hasMore: transactions.length < total,
		isLoadingMore,
		isSubmitting,
		kind,
		language,
		listReference,
		listState,
		loadMore,
		setAmount: event => {
			setAmountValue(event.currentTarget.value);
		},
		setConfirmingTransactionId,
		setDate: event => {
			setDateValue(event.currentTarget.value);
		},
		setDescription: event => {
			setDescriptionValue(event.currentTarget.value);
		},
		setKind,
		submit,
		summaryState,
		total,
		totals,
		transactions,
	};
}

export { LOAD_STATE, type LoadState, type TransactionsState, useTransactions };
