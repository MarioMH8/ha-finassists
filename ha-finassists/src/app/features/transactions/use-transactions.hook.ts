import type { Category } from '@app/features/categories/categories-api';
import { fetchCategories } from '@app/features/categories/categories-api';
import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import { useFeatureFlags } from '@app/shell/feature-flags-context';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { currencyFractionDigits } from './transaction-amount';
import { monthsRange, todayIsoDate } from './transaction-dates';
import type { TransactionSummary } from './transaction-summary';
import { buildTransactionSummary, SUMMARY_MONTHS } from './transaction-summary';
import type { TransactionFormErrors } from './transaction-validation';
import { validateTransactionForm } from './transaction-validation';
import type { Transaction, TransactionKind } from './transactions-api';
import {
	createTransaction,
	deleteTransaction,
	deleteTransactions,
	fetchAllTransactions,
	fetchTransactionPage,
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
	categories: Category[];
	categoryId: string;
	clearFilters: () => void;
	closeEditor: () => void;
	confirmingTransactionId: string | undefined;
	copy: Copy;
	currencyCode: string;
	date: string;
	deleteSelectedTransactions: (ids: string[]) => Promise<string[]>;
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
	setCategoryId: (categoryId: string) => void;
	setConfirmingTransactionId: Dispatch<SetStateAction<string | undefined>>;
	setDate: (event: ChangeEvent<HTMLInputElement>) => void;
	setDescription: (event: ChangeEvent<HTMLInputElement>) => void;
	setKind: (kind: TransactionKind) => void;
	setPageSize: (size: PageSize) => void;
	submit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	summary: TransactionSummary | undefined;
	summaryState: LoadState;
	total: number;
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
	const { capabilities, ui } = useFeatureFlags();
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [total, setTotal] = useState(0);
	const [listState, setListState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [summary, setSummary] = useState<TransactionSummary | undefined>(undefined);
	const [summaryState, setSummaryState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [kind, setKindValue] = useState<TransactionKind>(TRANSACTION_KIND.EXPENSE);
	const [amount, setAmountValue] = useState('');
	const [date, setDateValue] = useState('');
	const [description, setDescriptionValue] = useState('');
	const [categoryId, setCategoryIdValue] = useState('');
	const [categories, setCategories] = useState<Category[]>([]);
	const [errors, setErrors] = useState<TransactionFormErrors>({});
	const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [confirmingTransactionId, setConfirmingTransactionId] = useState<string | undefined>(undefined);
	const [deletingTransactionId, setDeletingTransactionId] = useState<string | undefined>(undefined);
	const [focusAfterRemoval, setFocusAfterRemoval] = useState<number | undefined>(undefined);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingTransactionId, setEditingTransactionId] = useState<string | undefined>(undefined);
	const [filters, setFilters] = useState<TransactionFilters>({
		categoryId: '',
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
		filters.categoryId !== '' ||
		filters.fromDate !== '' ||
		filters.kind !== FILTER_KIND.ALL ||
		filters.search !== '' ||
		filters.toDate !== '';
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const canGoPrevious = pageIndex > 0;
	const canGoNext = (pageIndex + 1) * pageSize < total;

	useEffect(() => {
		// The default date depends on the browser clock, so it is set after hydration.
		setDateValue(current => current || todayIsoDate());
		const controller = new AbortController();
		if (ui.monthSummary) {
			void loadSummary(controller.signal);
		}
		if (capabilities.categories) {
			void loadCategories(controller.signal);
		}

		return () => controller.abort();
	}, [capabilities.categories, ui.monthSummary]);

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
					...(filters.categoryId !== '' && { categoryId: filters.categoryId }),
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
			const summaryTransactions = await fetchAllTransactions(monthsRange(SUMMARY_MONTHS), signal);
			if (generation === summaryGeneration.current) {
				setSummary(buildTransactionSummary(summaryTransactions, currencyCode, language));
				setSummaryState(LOAD_STATE.READY);
			}
		} catch {
			if (generation === summaryGeneration.current && !signal?.aborted) {
				setSummaryState(LOAD_STATE.ERROR);
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
		await Promise.all([loadList(), ...(ui.monthSummary ? [loadSummary()] : [])]);
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

	async function removeSelectedTransactions(ids: string[]): Promise<string[]> {
		try {
			await deleteTransactions(ids);
			setFeedback({ message: copy.transactionsDeleted, tone: 'success' });
			await refresh();

			return ids;
		} catch {
			setFeedback({ message: copy.transactionsDeleteError, tone: 'error' });

			return [];
		}
	}

	function openCreate(): void {
		setEditingTransactionId(undefined);
		setAmountValue('');
		setDateValue(todayIsoDate());
		setDescriptionValue('');
		setCategoryIdValue('');
		setKindValue(TRANSACTION_KIND.EXPENSE);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function openEdit(transaction: Transaction): void {
		setEditingTransactionId(transaction.id);
		setAmountValue(amountInputValue(transaction, currencyCode, language));
		setDateValue(transaction.transactionDate);
		setDescriptionValue(transaction.description);
		setCategoryIdValue(transaction.categoryId ?? '');
		setKindValue(transaction.kind);
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
		setFilters({ categoryId: '', fromDate: '', kind: FILTER_KIND.ALL, search: '', toDate: '' });
		setPageIndex(0);
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
		const validation = validateTransactionForm({ amount, categoryId, date, description, kind }, currencyCode);
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
		categories,
		categoryId,
		clearFilters,
		closeEditor,
		confirmingTransactionId,
		copy,
		currencyCode,
		date,
		deleteSelectedTransactions: removeSelectedTransactions,
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
		setCategoryId: setCategoryIdValue,
		setConfirmingTransactionId,
		setDate: event => {
			setDateValue(event.currentTarget.value);
		},
		setDescription: event => {
			setDescriptionValue(event.currentTarget.value);
		},
		setKind: changeKind,
		setPageSize,
		submit,
		summary,
		summaryState,
		total,
		transactions,
	};
}

export { type TransactionsState, useTransactions };
