import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { TEXT_INPUT_SIZE, TextInput } from '@app/components/text-input';
import { currencyFractionDigits } from '@app/features/transactions/transaction-amount';
import { DESCRIPTION_MAX_LENGTH } from '@app/features/transactions/transaction-validation';
import type { TransactionKind } from '@app/features/transactions/transactions-api';
import { TRANSACTION_KIND } from '@app/features/transactions/transactions-api';
import type { TransactionsState } from '@app/features/transactions/use-transactions.hook';
import type { Copy } from '@app/i18n';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './transaction-form.module.css';

type TransactionFormProps = Pick<
	TransactionsState,
	| 'amount'
	| 'amountReference'
	| 'closeEditor'
	| 'copy'
	| 'currencyCode'
	| 'date'
	| 'description'
	| 'editingTransactionId'
	| 'errors'
	| 'feedback'
	| 'isEditorOpen'
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

const FORM_ID = 'transaction-form';

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
	closeEditor,
	copy,
	currencyCode,
	date,
	description,
	editingTransactionId,
	errors,
	feedback,
	isEditorOpen,
	isSubmitting,
	kind,
	setAmount,
	setDate,
	setDescription,
	setKind,
	submit,
}: TransactionFormProps): ReactElement {
	const isEditing = editingTransactionId !== undefined;
	const amountHint = interpolate(copy.transactionAmountHint, {
		currency: currencyCode,
		digits: currencyFractionDigits(currencyCode),
	});
	const amountError = errors.amount ? amountErrorMessage(copy, errors.amount, currencyCode) : undefined;
	const dateError = errors.date ? copy.transactionDateRequired : undefined;
	const descriptionError = errors.description ? copy.transactionDescriptionTooLong : undefined;
	const submitLabel = isSubmitting
		? copy.transactionSubmitting
		: isEditing
			? copy.transactionSave
			: copy.transactionSubmit;
	const dialogFooter = (
		<>
			<Button
				onClick={closeEditor}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.ACCENT}
				aria-busy={isSubmitting}
				disabled={isSubmitting}
				form={FORM_ID}
				type='submit'
				variant={BUTTON_VARIANT.BRAND}>
				{submitLabel}
			</Button>
		</>
	);

	return (
		<Dialog
			closeLabel={copy.close}
			description={isEditing ? copy.transactionEditDescription : copy.transactionFormDescription}
			footer={dialogFooter}
			id='transaction-form-dialog'
			onClose={closeEditor}
			open={isEditorOpen}
			title={isEditing ? copy.transactionEditTitle : copy.transactionFormTitle}
			type={DIALOG_TYPE.STANDARD}>
			<form
				className={styles.form}
				id={FORM_ID}
				noValidate
				onSubmit={event => void submit(event)}>
				<div className={styles.grid}>
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
							data-autofocus
							id='transaction-amount'
							inputMode='decimal'
							invalid={Boolean(amountError)}
							name='amount'
							onChange={setAmount}
							ref={amountReference}
							size={TEXT_INPUT_SIZE.SMALL}
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
							size={TEXT_INPUT_SIZE.SMALL}
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
							size={TEXT_INPUT_SIZE.SMALL}
							value={description}
						/>
					</Field>
				</div>
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
			</form>
		</Dialog>
	);
}

export { TransactionForm };
