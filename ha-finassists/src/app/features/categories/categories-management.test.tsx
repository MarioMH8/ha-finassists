import { getCopy } from '@app/i18n';
import { LocaleProvider } from '@app/i18n/locale-context';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Category } from './categories-api';
import { CATEGORY_KIND } from './categories-api';
import { CATEGORY_FILTER, LOAD_STATE } from './categories-constants';
import { CategoryForm, CategoryList } from './components';
import type { CategoriesState } from './use-categories.hook';

const noop = (): void => undefined;
const asyncNoop = (): Promise<void> => Promise.resolve();

function category(overrides: Partial<Category> = {}): Category {
	return {
		createdAt: '2024-03-05T10:00:00.000Z',
		id: 'category-1',
		kind: 'expense',
		name: 'Food',
		scheduledTransactionCount: 0,
		transactionCount: 0,
		...overrides,
	};
}

function state(language: 'en' | 'es', overrides: Partial<CategoriesState> = {}): CategoriesState {
	return {
		cancelDelete: noop,
		categories: [],
		closeEditor: noop,
		confirmingCategoryId: undefined,
		copy: getCopy(language),
		deleteCategory: asyncNoop,
		deletingCategoryId: undefined,
		editingCategoryId: undefined,
		errors: {},
		feedback: undefined,
		filterKind: CATEGORY_FILTER.ALL,
		isEditorOpen: false,
		isSubmitting: false,
		kind: 'expense',
		language,
		listState: LOAD_STATE.READY,
		name: '',
		openCreate: noop,
		openEdit: noop,
		setConfirmingCategoryId: noop,
		setFilterKind: noop,
		setKind: noop,
		setName: noop,
		submit: asyncNoop,
		total: 0,
		...overrides,
	};
}

function render(language: 'en' | 'es', element: React.ReactElement): string {
	return renderToStaticMarkup(<LocaleProvider language={language}>{element}</LocaleProvider>);
}

describe('CategoryList', () => {
	test('shows an empty state without categories', () => {
		const markup = render('en', <CategoryList {...state('en')} />);

		expect(markup).toContain('No categories yet');
		expect(markup).not.toContain('category-filter-kind');
	});

	test('keeps the kind filter and explains a filtered empty state', () => {
		const markup = render('en', <CategoryList {...state('en', { filterKind: CATEGORY_KIND.INCOME })} />);

		expect(markup).toContain('No categories of this kind');
		expect(markup).not.toContain('No categories yet');
		expect(markup).toContain('category-filter-kind');
	});

	test('shows loading and error states', () => {
		expect(render('en', <CategoryList {...state('en', { listState: LOAD_STATE.LOADING })} />)).toContain(
			'Loading categories…'
		);
		expect(render('es', <CategoryList {...state('es', { listState: LOAD_STATE.ERROR })} />)).toContain(
			'No se pudieron cargar las categorías.'
		);
	});

	test('lists the name, kind and usage of each category', () => {
		const markup = render(
			'en',
			<CategoryList
				{...state('en', {
					categories: [
						category({ id: 'category-1', name: 'Food', transactionCount: 12 }),
						category({ id: 'category-2', kind: 'income', name: 'Salary' }),
					],
				})}
			/>
		);

		expect(markup).toContain('Food');
		expect(markup).toContain('Salary');
		expect(markup).toContain('>12</td>');
		expect(markup).toContain('aria-label="Options: Food"');
		expect(markup).toContain('New category');
		expect(markup).toContain('category-filter-kind');
	});

	test('announces the feedback message', () => {
		const markup = render(
			'es',
			<CategoryList
				{...state('es', {
					categories: [category()],
					feedback: { message: 'Categoría eliminada.', tone: 'success' },
				})}
			/>
		);

		expect(markup).toContain('Categoría eliminada.');
	});

	test('shows scheduled usage separately from recorded movements', () => {
		const markup = render(
			'en',
			<CategoryList
				{...state('en', {
					categories: [category({ scheduledTransactionCount: 2, transactionCount: 3 })],
				})}
			/>
		);

		expect(markup).toContain('3');
		expect(markup).toContain('2 scheduled');
	});
});

describe('CategoryForm', () => {
	test('creates a category with the expense kind preselected', () => {
		const markup = render('en', <CategoryForm {...state('en', { isEditorOpen: true })} />);

		expect(markup).toContain('New category');
		expect(markup).toContain('maxLength="40"');
		expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="expense"|<input[^>]*value="expense"[^>]*checked=""/u);
	});

	test('shows localized validation errors', () => {
		const markup = render(
			'es',
			<CategoryForm {...state('es', { errors: { name: 'tooLong' }, isEditorOpen: true, name: 'a'.repeat(41) })} />
		);

		expect(markup).toContain('Los nombres de categoría pueden tener hasta 40 caracteres.');
		expect(markup).toContain('aria-invalid="true"');
	});

	test('renames an existing category', () => {
		const markup = render(
			'en',
			<CategoryForm {...state('en', { editingCategoryId: 'category-1', isEditorOpen: true, name: 'Food' })} />
		);

		expect(markup).toContain('Rename category');
		expect(markup).toContain('value="Food"');
		expect(markup).toContain('Save changes');
	});
});
