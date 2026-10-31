import { LOAD_STATE } from '@app/features/transactions/transactions-constants';
import { getCopy } from '@app/i18n';
import { LocaleProvider } from '@app/i18n/locale-context';
import { FeatureFlagsProvider } from '@app/shell/feature-flags-context';
import type { FeatureFlags, UiFeatureFlags } from '@modules/shell/domain';
import { DEFAULT_FEATURE_FLAGS } from '@modules/shell/domain';
import { describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ScheduledPendingList } from './components/scheduled-pending-list';
import { ScheduledSummary } from './components/scheduled-summary';
import { ScheduledTransactionForm } from './components/scheduled-transaction-form';
import { ScheduledTransactionList } from './components/scheduled-transaction-list';
import type { ScheduledForecast, ScheduledTransaction } from './scheduled-transactions-api';
import { ScheduledTransactionsManagement } from './scheduled-transactions-management';
import type { ScheduledTransactionsState } from './use-scheduled-transactions.hook';

const noop = (): void => undefined;
const asyncNoop = (): Promise<void> => Promise.resolve();

function schedule(overrides: Partial<ScheduledTransaction> = {}): ScheduledTransaction {
	return {
		amountMinor: 1250,
		categoryId: null,
		createdAt: '2026-05-01T10:00:00.000Z',
		createdBy: 'user-1',
		currencyCode: 'EUR',
		description: 'Rent',
		endDate: null,
		frequency: 'monthly',
		id: 'schedule-1',
		interval: 1,
		kind: 'expense',
		nextDueDate: '2026-05-01',
		postingMode: 'automatic',
		startDate: '2026-05-01',
		status: 'active',
		...overrides,
	};
}

function forecast(overrides: Partial<ScheduledForecast> = {}): ScheduledForecast {
	return {
		byCategory: { expense: {}, income: {} },
		currencyCode: 'EUR',
		fromDate: '2026-05-01',
		items: [],
		limit: 100,
		offset: 0,
		toDate: '2026-05-30',
		today: '2026-05-15',
		total: 0,
		totals: { expenseMinor: 1000, incomeMinor: 2500, netMinor: 1500 },
		uncategorized: { expenseMinor: 0, incomeMinor: 0 },
		...overrides,
	};
}

function state(language: 'en' | 'es', overrides: Partial<ScheduledTransactionsState> = {}): ScheduledTransactionsState {
	return {
		amount: '',
		amountReference: createRef<HTMLInputElement>(),
		busyScheduleId: undefined,
		cancelDelete: noop,
		categories: [],
		categoryId: '',
		closeEditor: noop,
		confirmingScheduleId: undefined,
		copy: getCopy(language),
		currencyCode: 'EUR',
		deleteSchedule: asyncNoop,
		deletingScheduleId: undefined,
		description: '',
		editingScheduleId: undefined,
		endDate: '',
		errors: {},
		feedback: undefined,
		forecast: forecast(),
		forecastState: LOAD_STATE.READY,
		frequency: 'monthly',
		interval: '1',
		isEditorOpen: true,
		isSubmitting: false,
		kind: 'expense',
		language,
		listState: LOAD_STATE.READY,
		openCreate: noop,
		openEdit: noop,
		pauseSchedule: asyncNoop,
		pendingSchedules: [],
		postingMode: 'automatic',
		postSchedule: asyncNoop,
		resumeSchedule: asyncNoop,
		schedules: [],
		setAmount: noop,
		setCategoryId: noop,
		setConfirmingScheduleId: noop,
		setDescription: noop,
		setEndDate: noop,
		setFrequency: noop,
		setInterval: noop,
		setKind: noop,
		setPostingMode: noop,
		setStartDate: noop,
		skipSchedule: asyncNoop,
		startDate: '2026-05-01',
		submit: asyncNoop,
		today: '2026-05-15',
		...overrides,
	};
}

function features(overrides: Partial<UiFeatureFlags> = {}): FeatureFlags {
	return {
		capabilities: DEFAULT_FEATURE_FLAGS.capabilities,
		ui: { ...DEFAULT_FEATURE_FLAGS.ui, ...overrides },
	};
}

function render(language: 'en' | 'es', element: React.ReactElement, ui: Partial<UiFeatureFlags> = {}): string {
	return renderToStaticMarkup(
		<FeatureFlagsProvider features={features(ui)}>
			<LocaleProvider language={language}>{element}</LocaleProvider>
		</FeatureFlagsProvider>
	);
}

describe('ScheduledTransactionsManagement', () => {
	test('renders its initial server state without effects', () => {
		const markup = render('en', <ScheduledTransactionsManagement currencyCode='EUR' />);

		expect(markup).toContain('Loading forecast…');
		expect(markup).toContain('Loading scheduled movements…');
		expect(markup.match(/data-skeleton="rows"/g) ?? []).toHaveLength(1);
	});

	test('hides the forecast and pending panels when their flags are off', () => {
		const markup = render('en', <ScheduledTransactionsManagement currencyCode='EUR' />, {
			scheduledPending: false,
			scheduledSummary: false,
		});

		expect(markup).not.toContain('Upcoming 30 days');
		expect(markup).not.toContain('Waiting for confirmation');
		expect(markup).toContain('Loading scheduled movements…');
	});
});

describe('ScheduledSummary', () => {
	test('shows the next-30-days totals and the pending notice', () => {
		const markup = render(
			'en',
			<ScheduledSummary
				{...state('en', {
					pendingSchedules: [schedule()],
				})}
			/>
		);

		expect(markup).toContain('Upcoming 30 days');
		expect(markup).toContain('Scheduled income');
		expect(markup).toContain('25.00');
		expect(markup).toContain('Scheduled expenses');
		expect(markup).toContain('10.00');
		expect(markup).toContain('May 1, 2026');
		expect(markup).toContain('1 scheduled movement(s) need confirmation.');
	});

	test('shows loading and error states', () => {
		const loadingMarkup = render(
			'en',
			<ScheduledSummary {...state('en', { forecast: undefined, forecastState: LOAD_STATE.LOADING })} />
		);

		expect(loadingMarkup).toContain('Loading forecast…');
		expect(loadingMarkup).toContain('data-skeleton="text"');
		expect(render('es', <ScheduledSummary {...state('es', { forecastState: LOAD_STATE.ERROR })} />)).toContain(
			'No se pudo cargar la previsión de programados.'
		);
	});
});

describe('ScheduledPendingList', () => {
	test('shows manual overdue occurrences with post and skip actions', () => {
		const markup = render(
			'en',
			<ScheduledPendingList
				{...state('en', {
					pendingSchedules: [schedule({ postingMode: 'manual' })],
				})}
			/>
		);

		expect(markup).toContain('Waiting for confirmation');
		expect(markup).toContain('Overdue');
		expect(markup).toContain('Record');
		expect(markup).toContain('Skip');
		expect(markup).toContain('Rent');
	});
});

describe('ScheduledTransactionList', () => {
	test('shows an empty state without schedules', () => {
		expect(render('en', <ScheduledTransactionList {...state('en')} />)).toContain('No scheduled movements yet');
	});

	test('renders recurrence, mode and signed amount', () => {
		const markup = render(
			'en',
			<ScheduledTransactionList
				{...state('en', {
					schedules: [
						schedule({
							interval: 2,
							nextDueDate: '2026-06-01',
							postingMode: 'manual',
							status: 'paused',
						}),
					],
				})}
			/>
		);

		expect(markup).toContain('Rent');
		expect(markup).toContain('Every 2 months');
		expect(markup).toContain('Manual');
		expect(markup).toContain('Paused');
		expect(markup).toContain('12.50');
	});

	test('shows loading and error states', () => {
		const loadingMarkup = render(
			'en',
			<ScheduledTransactionList {...state('en', { listState: LOAD_STATE.LOADING })} />
		);

		expect(loadingMarkup).toContain('Loading scheduled movements…');
		expect(loadingMarkup).toContain('data-skeleton="rows"');
		expect(render('es', <ScheduledTransactionList {...state('es', { listState: LOAD_STATE.ERROR })} />)).toContain(
			'No se pudieron cargar los movimientos programados.'
		);
	});
});

describe('ScheduledTransactionForm', () => {
	test('offers recurrence, interval, end date and posting mode', () => {
		const markup = render('en', <ScheduledTransactionForm {...state('en')} />);

		expect(markup).toContain('New scheduled movement');
		expect(markup).toContain('First date');
		expect(markup).toContain('Every N months');
		expect(markup).toContain('Last date (optional)');
		expect(markup).toContain('When due');
		expect(markup).toContain('Automatic');
		expect(markup).toContain('Manual');
		expect(markup).toContain('Add scheduled movement');
	});

	test('hides interval and end date for one-time schedules', () => {
		const markup = render('en', <ScheduledTransactionForm {...state('en', { frequency: 'once' })} />);

		expect(markup).not.toContain('Every N');
		expect(markup).not.toContain('Last date (optional)');
	});

	test('shows localized errors and future-only edit feedback', () => {
		const markup = render(
			'es',
			<ScheduledTransactionForm
				{...state('es', {
					editingScheduleId: 'schedule-1',
					errors: { endDate: 'range', interval: 'invalid' },
				})}
			/>
		);

		expect(markup).toContain('Introduce un número entre 1 y 999.');
		expect(markup).toContain('La última fecha debe ser igual o posterior a la primera.');
		expect(markup).toContain('Los cambios solo afectan a las ocurrencias futuras.');
	});
});
