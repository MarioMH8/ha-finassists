import { getCopy } from '@app/i18n';
import { LocaleProvider } from '@app/i18n/locale-context';
import { App } from '@app/shell/app';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import { describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MonthSummary, TransactionForm, TransactionList } from './components';
import { buildTransactionSummary } from './transaction-summary';
import type { Transaction } from './transactions-api';
import { LOAD_STATE } from './transactions-constants';
import type { TransactionsState } from './use-transactions.hook';

const noop = (): void => undefined;
const asyncNoop = (): Promise<void> => Promise.resolve();

function expense(overrides: Partial<Transaction> = {}): Transaction {
	return {
		actorId: 'actor',
		amountMinor: 1250,
		createdAt: '2024-03-05T10:00:00.000Z',
		currencyCode: 'EUR',
		description: 'Lunch',
		id: 'transaction-1',
		kind: 'expense',
		transactionDate: '2024-03-05',
		...overrides,
	};
}

function state(language: 'en' | 'es', overrides: Partial<TransactionsState> = {}): TransactionsState {
	return {
		amount: '',
		amountReference: createRef<HTMLInputElement>(),
		applyFilters: noop,
		cancelDelete: noop,
		canGoNext: false,
		canGoPrevious: false,
		clearFilters: noop,
		closeEditor: noop,
		confirmingTransactionId: undefined,
		copy: getCopy(language),
		currencyCode: 'EUR',
		date: '2024-03-05',
		deleteSelectedTransactions: () => Promise.resolve([]),
		deleteTransaction: asyncNoop,
		deletingTransactionId: undefined,
		description: '',
		editingTransactionId: undefined,
		errors: {},
		feedback: undefined,
		filters: { fromDate: '', kind: 'all', search: '', toDate: '' },
		goToNextPage: noop,
		goToPreviousPage: noop,
		hasFilters: false,
		isEditorOpen: false,
		isSubmitting: false,
		kind: 'expense',
		language,
		listReference: createRef<HTMLTableSectionElement>(),
		listState: LOAD_STATE.READY,
		openCreate: noop,
		openEdit: noop,
		pageCount: 1,
		pageIndex: 0,
		pageSize: 20,
		setAmount: noop,
		setConfirmingTransactionId: noop,
		setDate: noop,
		setDescription: noop,
		setKind: noop,
		setPageSize: noop,
		submit: asyncNoop,
		summary: buildTransactionSummary([], 'EUR', language, new Date(2024, 2, 15)),
		summaryState: LOAD_STATE.READY,
		total: 0,
		transactions: [],
		...overrides,
	};
}

function render(language: 'en' | 'es', element: React.ReactElement): string {
	return renderToStaticMarkup(<LocaleProvider language={language}>{element}</LocaleProvider>);
}

describe('TransactionForm', () => {
	test('offers an expense and income toggle with the expense preselected', () => {
		const markup = render('en', <TransactionForm {...state('en')} />);

		expect(markup).toContain('Expense');
		expect(markup).toContain('Income');
		expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="expense"|<input[^>]*value="expense"[^>]*checked=""/u);
		expect(markup).toContain('value="2024-03-05"');
		expect(markup).toContain('maxLength="200"');
		expect(markup).toContain('up to 2 decimal places');
	});

	test('shows localized field errors', () => {
		const markup = render(
			'es',
			<TransactionForm {...state('es', { errors: { amount: 'precision', date: 'required' } })} />
		);

		expect(markup).toContain('EUR admite como máximo 2 decimales.');
		expect(markup).toContain('Elige una fecha válida.');
		expect(markup).toContain('aria-invalid="true"');
	});

	test('announces submission feedback', () => {
		const markup = render(
			'en',
			<TransactionForm {...state('en', { feedback: { message: 'Transaction added.', tone: 'success' } })} />
		);

		expect(markup).toContain('Transaction added.');
	});
});

describe('TransactionList', () => {
	test('shows an empty state without transactions', () => {
		expect(render('en', <TransactionList {...state('en')} />)).toContain('No transactions yet');
	});

	test('shows loading and error states', () => {
		expect(render('en', <TransactionList {...state('en', { listState: LOAD_STATE.LOADING })} />)).toContain(
			'Loading transactions…'
		);
		expect(render('es', <TransactionList {...state('es', { listState: LOAD_STATE.ERROR })} />)).toContain(
			'No se pudieron cargar las transacciones.'
		);
	});

	test('renders signed amounts, descriptions and pagination without a kind column', () => {
		const markup = render(
			'en',
			<TransactionList
				{...state('en', {
					canGoNext: true,
					filters: { fromDate: '2024-03-01', kind: 'all', search: '', toDate: '2024-03-31' },
					hasFilters: true,
					pageCount: 3,
					pageSize: 10,
					total: 25,
					transactions: [
						expense(),
						expense({ amountMinor: 200_000, description: '', id: 'transaction-2', kind: 'income' }),
					],
				})}
			/>
		);

		expect(markup).toContain('-€12.50');
		expect(markup).toContain('+€2,000.00');
		expect(markup).toContain('Lunch');
		expect(markup).toContain('No description');
		expect(markup).toContain('Showing 1–10 of 25');
		expect(markup).toContain('Page 1 of 3');
		expect(markup).toContain('Rows per page');
		expect(markup).toContain('Filters');
		expect(markup).toContain('Search description');
		expect(markup).toContain('Apply filters');
		expect(markup).toContain('Clear filters');
		expect(markup).not.toContain('>Type</th>');
	});

	test('offers a row options menu with edit and delete actions', () => {
		const markup = render('en', <TransactionList {...state('en', { total: 1, transactions: [expense()] })} />);

		expect(markup).toContain('aria-label="Options: Lunch"');
		expect(markup).toContain('aria-haspopup="menu"');
		expect(markup).toContain('New transaction');
	});

	test('offers per-row and select-all checkboxes for bulk deletion', () => {
		const markup = render('en', <TransactionList {...state('en', { total: 1, transactions: [expense()] })} />);

		expect(markup).toContain('aria-label="Select all transactions"');
		expect(markup).toContain('aria-label="Select transaction: Lunch"');
		expect(markup).toContain('Delete selected transactions?');
	});

	test('asks for confirmation in a dialog before deleting', () => {
		const markup = render(
			'es',
			<TransactionList
				{...state('es', { confirmingTransactionId: 'transaction-1', total: 1, transactions: [expense()] })}
			/>
		);

		expect(markup).toContain('¿Eliminar transacción?');
		expect(markup).toContain('Esto elimina permanentemente');
		expect(markup).toContain('Lunch');
		expect(markup).toContain('>Cancelar<');
		expect(markup).toContain('>Eliminar<');
	});

	test('shows a filtered empty state when no transaction matches', () => {
		const markup = render(
			'en',
			<TransactionList
				{...state('en', {
					filters: { fromDate: '2024-03-01', kind: 'income', search: '', toDate: '' },
					hasFilters: true,
				})}
			/>
		);

		expect(markup).toContain('No matching transactions');
		expect(markup).toContain('Clear filters');
	});
});

describe('MonthSummary', () => {
	test('shows income, expenses and net totals', () => {
		const summary = buildTransactionSummary([], 'EUR', 'en', new Date(2024, 2, 15));
		const markup = render(
			'en',
			<MonthSummary
				{...state('en', {
					summary: {
						...summary,
						expenseMinor: 2000,
						incomeMinor: 5000,
						netMinor: 3000,
					},
				})}
			/>
		);

		expect(markup).toContain('€50.00');
		expect(markup).toContain('€20.00');
		expect(markup).toContain('+€30.00');
		expect(markup).toContain('Income and expenses');
		expect(markup).toContain('aria-label="Show chart"');
		expect(markup).toContain('aria-expanded="false"');
	});

	test('shows an error when totals cannot be loaded', () => {
		expect(render('es', <MonthSummary {...state('es', { summaryState: LOAD_STATE.ERROR })} />)).toContain(
			'No se pudieron cargar los totales de este mes.'
		);
	});
});

describe('App', () => {
	test('renders transactions first and the API tokens navigation', () => {
		const markup = renderToStaticMarkup(
			<App
				language='es'
				settings={DEFAULT_SHELL_CONFIG}
			/>
		);

		expect(markup).toContain('Nueva transacción');
		expect(markup).toContain('Transacciones');
		expect(markup).toContain('Tokens API');
		expect(markup).not.toContain('Resumen');
	});

	test('renders a visually hidden page heading without a branded header', () => {
		const markup = renderToStaticMarkup(
			<App
				language='en'
				settings={DEFAULT_SHELL_CONFIG}
			/>
		);

		expect(markup).toContain('New transaction');
		expect(markup).toContain('Application navigation');
		expect(markup).toContain('<main');
		expect(markup.indexOf('<h1')).toBeGreaterThan(markup.indexOf('<main'));
		expect(markup).not.toContain('data-application-name="Fin Assist"');
		expect(markup).toContain('aria-hidden="true"');
	});
});
