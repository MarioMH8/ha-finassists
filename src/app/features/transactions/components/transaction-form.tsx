import { Button, BUTTON_VARIANT } from '@app/components/button';
import { Card } from '@app/components/card';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import { TextInput } from '@app/components/text-input';
import type { Copy } from '@app/i18n';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import { currencyFractionDigits } from '../transaction-amount';
import { DESCRIPTION_MAX_LENGTH } from '../transaction-validation';
import type { TransactionKind } from '../transactions-api';
import { TRANSACTION_KIND } from '../transactions-api';
import type { TransactionsState } from '../use-transactions.hook';
import styles from './transaction-form.module.css';

type TransactionFormProps = Pick<
	TransactionsState,
	| 'amount'
	| 'amountReference'
	| 'copy'
	| 'currencyCode'
	| 'date'
	| 'description'
	| 'errors'
	| 'feedback'
	| 'isSubmitting'
	| 'kind'
	| 'setAmount'
	| 'setDate'
	| 'setDescription'
	| 'setKind'
	| 'submit'
>;

const KIND_OPTIONS: readonly {
	label: 'transactionKindExpense' | 'transactionKindIncome';
	value: TransactionKind;
}[] = [
	{ label: 'transactionKindExpense', value: TRANSACTION_KIND.EXPENSE },
	{ label: 'transactionKindIncome', value: TRANSACTION_KIND.INCOME },
];

function amountErrorMessage(
	copy: Copy,
	error: NonNullable<TransactionFormProps['errors']['amount']>,
	currencyCode: string
): string {
	switch (error) {
		case 'invalid': {
			return copy.transactionAmountInvalid;
		}
		case 'notPositive': {
			return copy.transactionAmountNotPositive;
		}
		case 'precision': {
			return interpolate(copy.transactionAmountPrecision, {
				currency: currencyCode,
				digits: currencyFractionDigits(currencyCode),
			});
		}
		case 'required': {
			return copy.transactionAmountRequired;
		}
		case 'tooLarge': {
			return copy.transactionAmountTooLarge;
		}
	}
}

function TransactionForm({
	amount,
	amountReference,
	copy,
	currencyCode,
	date,
	description,
	errors,
	feedback,
	isSubmitting,
	kind,
	setAmount,
	setDate,
	setDescription,
	setKind,
	submit,
}: TransactionFormProps): ReactElement {
	const amountHint = interpolate(copy.transactionAmountHint, {
		currency: currencyCode,
		digits: currencyFractionDigits(currencyCode),
	});
	const amountError = errors.amount ? amountErrorMessage(copy, errors.amount, currencyCode) : undefined;
	const dateError = errors.date ? copy.transactionDateRequired : undefined;
	const descriptionError = errors.description ? copy.transactionDescriptionTooLong : undefined;

	return (
		<Card aria-labelledby='transaction-form-title'>
			<SectionHeading
				description={copy.transactionFormDescription}
				title={copy.transactionFormTitle}
				titleId='transaction-form-title'
			/>
			<form
				className={styles.form}
				noValidate
				onSubmit={event => void submit(event)}>
				<fieldset className={styles.kind}>
					<legend className={styles.legend}>{copy.transactionKindLabel}</legend>
					<div className={styles.options}>
						{KIND_OPTIONS.map(option => (
							<label
								className={styles.option}
								key={option.value}>
								<input
									checked={kind === option.value}
									className={styles.radio}
									name='kind'
									onChange={() => {
										setKind(option.value);
									}}
									type='radio'
									value={option.value}
								/>
								<span className={styles.optionLabel}>{copy[option.label]}</span>
							</label>
						))}
					</div>
				</fieldset>
				<div className={styles.grid}>
					<Field
						error={amountError}
						hint={amountHint}
						htmlFor='transaction-amount'
						label={copy.transactionAmountLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('transaction-amount', {
								error: amountError,
								hint: amountHint,
							})}
							autoComplete='off'
							id='transaction-amount'
							inputMode='decimal'
							invalid={Boolean(amountError)}
							name='amount'
							onChange={setAmount}
							ref={amountReference}
							value={amount}
						/>
					</Field>
					<Field
						error={dateError}
						htmlFor='transaction-date'
						label={copy.transactionDateLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('transaction-date', { error: dateError })}
							id='transaction-date'
							invalid={Boolean(dateError)}
							name='transactionDate'
							onChange={setDate}
							type='date'
							value={date}
						/>
					</Field>
					<Field
						className={styles.description}
						error={descriptionError}
						hint={copy.transactionDescriptionHint}
						htmlFor='transaction-description'
						label={copy.transactionDescriptionLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('transaction-description', {
								error: descriptionError,
								hint: copy.transactionDescriptionHint,
							})}
							autoComplete='off'
							id='transaction-description'
							invalid={Boolean(descriptionError)}
							maxLength={DESCRIPTION_MAX_LENGTH}
							name='description'
							onChange={setDescription}
							value={description}
						/>
					</Field>
				</div>
				<div className={styles.actions}>
					<Button
						aria-busy={isSubmitting}
						disabled={isSubmitting}
						type='submit'
						variant={BUTTON_VARIANT.PRIMARY}>
						{isSubmitting ? copy.transactionSubmitting : copy.transactionSubmit}
					</Button>
					<div
						aria-atomic='true'
						aria-live='polite'
						className={styles.feedback}>
						{feedback ? (
							<Notice tone={feedback.tone === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
								{feedback.message}
							</Notice>
						) : undefined}
					</div>
				</div>
			</form>
		</Card>
	);
}

export { TransactionForm };
