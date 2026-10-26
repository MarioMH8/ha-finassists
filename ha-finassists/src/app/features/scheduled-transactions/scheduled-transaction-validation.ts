import type { AmountError } from '@app/features/transactions/transaction-amount';
import { parseAmountMinor } from '@app/features/transactions/transaction-amount';
import { isIsoDate } from '@app/features/transactions/transaction-dates';
import { DESCRIPTION_MAX_LENGTH } from '@app/features/transactions/transaction-validation';
import type { TransactionKind } from '@app/features/transactions/transactions-api';

import type {
	NewScheduledTransaction,
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
} from './scheduled-transactions-api';
import { SCHEDULED_TRANSACTION_FREQUENCY } from './scheduled-transactions-api';

const MAX_INTERVAL = 999;

interface ScheduledTransactionFormValues {
	amount: string;
	categoryId: string;
	date: string;
	description: string;
	endDate: string;
	frequency: ScheduledTransactionFrequency;
	interval: string;
	kind: TransactionKind;
	postingMode: ScheduledTransactionPostingMode;
}

interface ScheduledTransactionFormErrors {
	amount?: AmountError;
	date?: 'required';
	description?: 'tooLong';
	endDate?: 'invalid' | 'range';
	interval?: 'invalid';
}

type ScheduledTransactionValidation =
	| { errors: ScheduledTransactionFormErrors; transaction?: undefined }
	| { errors?: undefined; transaction: NewScheduledTransaction };

function validateScheduledTransactionForm(
	values: ScheduledTransactionFormValues,
	currencyCode: string
): ScheduledTransactionValidation {
	const errors: ScheduledTransactionFormErrors = {};
	const amount = parseAmountMinor(values.amount, currencyCode);
	if (amount.error) {
		errors.amount = amount.error;
	}
	if (!isIsoDate(values.date)) {
		errors.date = 'required';
	}
	const description = values.description.trim();
	if (description.length > DESCRIPTION_MAX_LENGTH) {
		errors.description = 'tooLong';
	}
	const interval = values.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE ? 1 : Number(values.interval);
	if (
		values.frequency !== SCHEDULED_TRANSACTION_FREQUENCY.ONCE &&
		(!Number.isSafeInteger(interval) || interval < 1 || interval > MAX_INTERVAL)
	) {
		errors.interval = 'invalid';
	}
	const endDate =
		values.frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE || values.endDate === '' ? undefined : values.endDate;
	if (endDate !== undefined) {
		if (!isIsoDate(endDate)) {
			errors.endDate = 'invalid';
		} else if (isIsoDate(values.date) && endDate < values.date) {
			errors.endDate = 'range';
		}
	}
	if (amount.error || errors.date || errors.description || errors.endDate || errors.interval) {
		return { errors };
	}

	return {
		transaction: {
			amountMinor: amount.minor,
			// Clearing a category is an explicit null in the API contract.
			// eslint-disable-next-line unicorn/no-null
			categoryId: values.categoryId === '' ? null : values.categoryId,
			description,
			// An absent end date is an explicit null in the API contract.
			// eslint-disable-next-line unicorn/no-null
			endDate: endDate ?? null,
			frequency: values.frequency,
			interval,
			kind: values.kind,
			postingMode: values.postingMode,
			startDate: values.date,
		},
	};
}

export {
	MAX_INTERVAL,
	type ScheduledTransactionFormErrors,
	type ScheduledTransactionFormValues,
	type ScheduledTransactionValidation,
	validateScheduledTransactionForm,
};
