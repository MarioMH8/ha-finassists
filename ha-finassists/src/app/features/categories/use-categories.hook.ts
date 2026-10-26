import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import type { ChangeEvent, Dispatch, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useState } from 'react';

import type { Category, CategoryKind } from './categories-api';
import {
	CategoriesApiError,
	CATEGORY_KIND,
	CONFLICT_STATUS,
	createCategory,
	deleteCategory as deleteCategoryRequest,
	fetchCategories,
	updateCategory,
} from './categories-api';
import type { CategoryFilter, CategoryFormErrors, LoadState } from './categories-constants';
import { CATEGORY_FILTER, CATEGORY_NAME_MAX_LENGTH, LOAD_STATE } from './categories-constants';

interface Feedback {
	message: string;
	tone: 'error' | 'success';
}

interface CategoriesState {
	cancelDelete: () => void;
	categories: Category[];
	closeEditor: () => void;
	confirmingCategoryId: string | undefined;
	copy: Copy;
	deleteCategory: (category: Category) => Promise<void>;
	deletingCategoryId: string | undefined;
	editingCategoryId: string | undefined;
	errors: CategoryFormErrors;
	feedback: Feedback | undefined;
	filterKind: CategoryFilter;
	isEditorOpen: boolean;
	isSubmitting: boolean;
	kind: CategoryKind;
	language: Language;
	listState: LoadState;
	name: string;
	openCreate: () => void;
	openEdit: (category: Category) => void;
	setConfirmingCategoryId: Dispatch<SetStateAction<string | undefined>>;
	setFilterKind: (kind: CategoryFilter) => void;
	setKind: (kind: CategoryKind) => void;
	setName: (event: ChangeEvent<HTMLInputElement>) => void;
	submit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	total: number;
}

function validate(name: string): CategoryFormErrors {
	const trimmed = name.trim();
	if (trimmed === '') {
		return { name: 'required' };
	}
	if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
		return { name: 'tooLong' };
	}

	return {};
}

function useCategories(): CategoriesState {
	const { copy, language } = useLocale();
	const [categories, setCategories] = useState<Category[]>([]);
	const [listState, setListState] = useState<LoadState>(LOAD_STATE.LOADING);
	const [filterKind, setFilterKind] = useState<CategoryFilter>(CATEGORY_FILTER.ALL);
	const [name, setNameValue] = useState('');
	const [kind, setKindValue] = useState<CategoryKind>(CATEGORY_KIND.EXPENSE);
	const [errors, setErrors] = useState<CategoryFormErrors>({});
	const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingCategoryId, setEditingCategoryId] = useState<string | undefined>(undefined);
	const [confirmingCategoryId, setConfirmingCategoryId] = useState<string | undefined>(undefined);
	const [deletingCategoryId, setDeletingCategoryId] = useState<string | undefined>(undefined);

	useEffect(() => {
		const controller = new AbortController();
		void load(controller.signal);

		return () => controller.abort();
	}, [filterKind]);

	async function load(signal?: AbortSignal): Promise<void> {
		setListState(LOAD_STATE.LOADING);
		try {
			const items = await fetchCategories(filterKind === CATEGORY_FILTER.ALL ? undefined : filterKind, signal);
			if (!signal?.aborted) {
				setCategories(items);
				setListState(LOAD_STATE.READY);
			}
		} catch {
			if (!signal?.aborted) {
				setListState(LOAD_STATE.ERROR);
			}
		}
	}

	function openCreate(): void {
		setEditingCategoryId(undefined);
		setNameValue('');
		setKindValue(CATEGORY_KIND.EXPENSE);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function openEdit(category: Category): void {
		setEditingCategoryId(category.id);
		setNameValue(category.name);
		setKindValue(category.kind);
		setErrors({});
		setFeedback(undefined);
		setIsEditorOpen(true);
	}

	function closeEditor(): void {
		setIsEditorOpen(false);
		setEditingCategoryId(undefined);
		setErrors({});
	}

	async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (isSubmitting) {
			return;
		}
		const nextErrors = validate(name);
		setErrors(nextErrors);
		setFeedback(undefined);
		if (nextErrors.name !== undefined) {
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingCategoryId === undefined) {
				await createCategory({ kind, name: name.trim() });
				setFeedback({ message: copy.categoryCreated, tone: 'success' });
			} else {
				await updateCategory(editingCategoryId, { kind, name: name.trim() });
				setFeedback({ message: copy.categoryUpdated, tone: 'success' });
			}
			setIsEditorOpen(false);
			setEditingCategoryId(undefined);
			await load();
		} catch (error) {
			setFeedback({
				message:
					error instanceof CategoriesApiError && error.status === CONFLICT_STATUS
						? copy.categoryConflict
						: editingCategoryId === undefined
							? copy.categoryCreateError
							: copy.categoryUpdateError,
				tone: 'error',
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	async function removeCategory(category: Category): Promise<void> {
		setDeletingCategoryId(category.id);
		try {
			await deleteCategoryRequest(category.id);
			setConfirmingCategoryId(undefined);
			setFeedback({ message: copy.categoryDeleted, tone: 'success' });
			await load();
		} catch (error) {
			setConfirmingCategoryId(undefined);
			setFeedback({
				message:
					error instanceof CategoriesApiError && error.status === CONFLICT_STATUS
						? copy.categoryDeleteInUse
						: copy.categoryDeleteError,
				tone: 'error',
			});
		} finally {
			setDeletingCategoryId(undefined);
		}
	}

	function setFilter(nextFilter: CategoryFilter): void {
		setFilterKind(nextFilter);
	}

	function setKind(nextKind: CategoryKind): void {
		setKindValue(nextKind);
	}

	return {
		cancelDelete: () => {
			setConfirmingCategoryId(undefined);
		},
		categories,
		closeEditor,
		confirmingCategoryId,
		copy,
		deleteCategory: removeCategory,
		deletingCategoryId,
		editingCategoryId,
		errors,
		feedback,
		filterKind,
		isEditorOpen,
		isSubmitting,
		kind,
		language,
		listState,
		name,
		openCreate,
		openEdit,
		setConfirmingCategoryId,
		setFilterKind: setFilter,
		setKind,
		setName: event => {
			setNameValue(event.currentTarget.value);
		},
		submit,
		total: categories.length,
	};
}

export { type CategoriesState, useCategories };
