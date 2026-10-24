import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { currencyFractionDigits } from './transaction-amount';
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
	updateTransaction,
} from './transactions-api';
import type { LoadState, PageSize, TransactionFilters } from './transactions-constants';
import { DEFAULT_PAGE_SIZE, FILTER_KIND, LOAD_STATE } from './transactions-constants';

interface Feedback {
	message: string;
	tone: 'error' | 'success';
}

interface TransactionsState {
	amount: string;
	amountReference: RefObject<HTMLInputElement | null>;
	applyFilters: (filters: TransactionFilters) => void;
	canGoNext: boolean;
	canGoPrevious: boolean;
	cancelDelete: () => void;
	clearFilters: () => void;
	closeEditor: () => void;
	confirmingTransactionId: string | undefined;
	copy: Copy;
	currencyCode: string;
	date: string;
	deleteTransaction: (transaction: Transaction) => Promise<void>;
	deletingTransactionId: string | undefined;
	description: string;
	editingTransactionId: string | undefined;
	errors: TransactionFormErrors;
	feedback: Feedback | undefined;
	filters: TransactionFilters;
	goToNextPage: () => void;
	goToPreviousPage: () => void;
	hasFilters: boolean;
	isEditorOpen: boolean;
	isSubmitting: boolean;
	kind: TransactionKind;
	language: Language;
	listReference: RefObject<HTMLTableSectionElement | null>;
	listState: LoadState;
	openCreate: () => void;
	openEdit: (transaction: Transaction) => void;
	pageCount: number;
	pageIndex: number;
	pageSize: PageSize;
	setAmount: (event: ChangeEvent<HTMLInputElement>) => void;
	setConfirmingTransactionId: Dispatch<SetStateAction<string | undefined>>;
	setDate: (event: ChangeEvent<HTMLInputElement>) => void;
	setDescription: (event: ChangeEvent<HTMLInputElement>) => void;
	setKind: (kind: TransactionKind) => void;
	setPageSize: (size: PageSize) => void;
	submit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	summaryState: LoadState;
	total: number;
	totals: TransactionTotals | undefined;
	transactions: Transaction[];
}

function amountInputValue(transaction: Transaction, currencyCode: string, language: Language): string {
	const digits = currencyFractionDigits(currencyCode);

	return new Intl.NumberFormat(language, {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
		useGrouping: false,
	}).format(transaction.amountMinor / 10 ** digits);
}

function useTransactions(currencyCode: string): TransactionsState {
	const { copy, language } = useLocale();
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [total, setTotal] = useState(0);
	const [listState, setListState] = useState<LoadState>(LOAD_STATE.LOADING);
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
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingTransactionId, setEditingTransactionId] = useState<string | undefined>(undefined);
	const [filters, setFilters] = useState<TransactionFilters>({
		fromDate: '',
		kind: FILTER_KIND.ALL,
		search: '',
		toDate: '',
	});
	const [pageIndex, setPageIndex] = useState(0);
	const [pageSize, setPageSizeValue] = useState<PageSize>(DEFAULT_PAGE_SIZE);
	const amountReference = useRef<HTMLInputElement>(null);
	const listReference = useRef<HTMLTableSectionElement>(null);
	const listGeneration = useRef(0);
	const summaryGeneration = useRef(0);
	const hasFilters =
		filters.fromDate !== '' || filters.kind !== FILTER_KIND.ALL || filters.search !== '' || filters.toDate !== '';
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const canGoPrevious = pageIndex > 0;
	const canGoNext = (pageIndex + 1) * pageSize < total;

	useEffect(() => {
		// The default date depends on the browser clock, so it is set after hydration.
		setDateValue(current => current || todayIsoDate());
		const controller = new AbortController();
		void loadSummary(controller.signal);

		return () => controller.abort();
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void loadList(controller.signal);

		return () => controller.abort();
	}, [filters, pageIndex, pageSize]);

	useEffect(() => {
		if (focusAfterRemoval === undefined) {
			return;
		}

		const triggers = listReference.current?.querySelectorAll<HTMLButtonElement>('[aria-haspopup="menu"]');
		const lastIndex = Math.max(0, (triggers?.length ?? 1) - 1);
		(triggers?.[Math.min(focusAfterRemoval, lastIndex)] ?? amountReference.current)?.focus();
		setFocusAfterRemoval(undefined);
	}, [focusAfterRemoval, transactions]);

	async function loadList(signal?: AbortSignal): Promise<void> {
		const generation = ++listGeneration.current;
		setListState(LOAD_STATE.LOADING);
		try {
			const page = await fetchTransactionPage(
				{
					limit: pageSize,
					offset: pageIndex * pageSize,
					...(filters.kind !== FILTER_KIND.ALL && { kind: filters.kind }),
					...(filters.fromDate !== '' && { fromDate: filters.fromDate }),
					...(filters.search !== '' && { search: filters.search }),
					...(filters.toDate !== '' && { toDate: filters.toDate }),
				},
				signal
			);
			if (generation === listGeneration.current) {
				if (page.items.length === 0 && page.total > 0 && pageIndex > 0) {
					setPageIndex(Math.max(0, Math.ceil(page.total / pageSize) - 1));

					return;
				}
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

	async function removeTransaction(transaction: Transaction): Promise<void> {
		const index = transactions.findIndex(existing => existing.id === transaction.id);
		setDeletingTransactionId(transaction.id);
		try {
			await deleteTransaction(transaction.id);
			setConfirmingTransactionId(undefined);
			setFeedback({ message: copy.transactionDeleted, tone: 'success' });
			setFocusAfterRemoval(index);
			await refresh();
		} catch {
			setConfirmingTransactionId(undefined);
			setFeedback({ message: copy.transactionDeleteError, tone: 'error' });
		} finally {
			setDeletingTransactionId(undefined);
		}
	}

	function cancelDelete(): void {
		setConfirmingTransactionId(undefined);
	}

	function openCreate(): void {
		setEditingTransactionId(undefined);
		setAmountValue('');
		setDateValue(todayIsoDate());
		setDescriptionValue('');
		setKind(TRANSACTION_KIND.EXPENSE);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function openEdit(transaction: Transaction): void {
		setEditingTransactionId(transaction.id);
		setAmountValue(amountInputValue(transaction, currencyCode, language));
		setDateValue(transaction.transactionDate);
		setDescriptionValue(transaction.description);
		setKind(transaction.kind);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function closeEditor(): void {
		setIsEditorOpen(false);
		setEditingTransactionId(undefined);
		setErrors({});
	}

	function applyFilters(next: TransactionFilters): void {
		setFilters(next);
		setPageIndex(0);
	}

	function clearFilters(): void {
		setFilters({ fromDate: '', kind: FILTER_KIND.ALL, search: '', toDate: '' });
		setPageIndex(0);
	}

	function goToNextPage(): void {
		setPageIndex(current => Math.min(current + 1, pageCount - 1));
	}

	function goToPreviousPage(): void {
		setPageIndex(current => Math.max(0, current - 1));
	}

	function setPageSize(size: PageSize): void {
		setPageSizeValue(size);
		setPageIndex(0);
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
			if (editingTransactionId === undefined) {
				await createTransaction(validation.transaction);
				setFeedback({ message: copy.transactionCreated, tone: 'success' });
			} else {
				await updateTransaction(editingTransactionId, validation.transaction);
				setFeedback({ message: copy.transactionUpdated, tone: 'success' });
			}
			setIsEditorOpen(false);
			setEditingTransactionId(undefined);
			await refresh();
		} catch {
			setFeedback({
				message: editingTransactionId === undefined ? copy.transactionCreateError : copy.transactionUpdateError,
				tone: 'error',
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	return {
		amount,
		amountReference,
		applyFilters,
		cancelDelete,
		canGoNext,
		canGoPrevious,
		clearFilters,
		closeEditor,
		confirmingTransactionId,
		copy,
		currencyCode,
		date,
		deleteTransaction: removeTransaction,
		deletingTransactionId,
		description,
		editingTransactionId,
		errors,
		feedback,
		filters,
		goToNextPage,
		goToPreviousPage,
		hasFilters,
		isEditorOpen,
		isSubmitting,
		kind,
		language,
		listReference,
		listState,
		openCreate,
		openEdit,
		pageCount,
		pageIndex,
		pageSize,
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
		setPageSize,
		submit,
		summaryState,
		total,
		totals,
		transactions,
	};
}

export { type TransactionsState, useTransactions };
