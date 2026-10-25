import type { AmountError } from './transaction-amount';
import { parseAmountMinor } from './transaction-amount';
import { isIsoDate } from './transaction-dates';
import type { NewTransaction, TransactionKind } from './transactions-api';

const DESCRIPTION_MAX_LENGTH = 200;

interface TransactionFormValues {
	amount: string;
	date: string;
	description: string;
	kind: TransactionKind;
}

interface TransactionFormErrors {
	amount?: AmountError;
	date?: 'required';
	description?: 'tooLong';
}

type TransactionValidation =
	{ errors: TransactionFormErrors; transaction?: undefined } | { errors?: undefined; transaction: NewTransaction };

function validateTransactionForm(values: TransactionFormValues, currencyCode: string): TransactionValidation {
	const errors: TransactionFormErrors = {};
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
	if (amount.error || errors.date || errors.description) {
		return { errors };
	}

	return {
		transaction: {
			amountMinor: amount.minor,
			description,
			kind: values.kind,
			transactionDate: values.date,
		},
	};
}

export {
	DESCRIPTION_MAX_LENGTH,
	type TransactionFormErrors,
	type TransactionFormValues,
	type TransactionValidation,
	validateTransactionForm,
};
