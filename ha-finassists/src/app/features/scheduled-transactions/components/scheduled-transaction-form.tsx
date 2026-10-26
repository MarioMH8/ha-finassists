import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { Select, SELECT_SIZE } from '@app/components/select';
import { TEXT_INPUT_SIZE, TextInput } from '@app/components/text-input';
import { intervalUnitLabel } from '@app/features/scheduled-transactions/scheduled-transaction-recurrence';
import type {
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
} from '@app/features/scheduled-transactions/scheduled-transactions-api';
import {
	SCHEDULED_TRANSACTION_FREQUENCY,
	SCHEDULED_TRANSACTION_POSTING_MODE,
} from '@app/features/scheduled-transactions/scheduled-transactions-api';
import type { ScheduledTransactionsState } from '@app/features/scheduled-transactions/use-scheduled-transactions.hook';
import { currencyFractionDigits } from '@app/features/transactions/transaction-amount';
import { DESCRIPTION_MAX_LENGTH } from '@app/features/transactions/transaction-validation';
import type { TransactionKind } from '@app/features/transactions/transactions-api';
import { TRANSACTION_KIND } from '@app/features/transactions/transactions-api';
import type { Copy } from '@app/i18n';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './scheduled-transaction-form.module.css';

type ScheduledTransactionFormProps = Pick<
	ScheduledTransactionsState,
	| 'amount'
	| 'amountReference'
	| 'categories'
	| 'categoryId'
	| 'closeEditor'
	| 'copy'
	| 'currencyCode'
	| 'description'
	| 'editingScheduleId'
	| 'endDate'
	| 'errors'
	| 'feedback'
	| 'frequency'
	| 'interval'
	| 'isEditorOpen'
	| 'isSubmitting'
	| 'kind'
	| 'postingMode'
	| 'setAmount'
	| 'setCategoryId'
	| 'setDescription'
	| 'setEndDate'
	| 'setFrequency'
	| 'setInterval'
	| 'setKind'
	| 'setPostingMode'
	| 'setStartDate'
	| 'startDate'
	| 'submit'
	| 'today'
>;

const KIND_OPTIONS: readonly {
	label: 'transactionKindExpense' | 'transactionKindIncome';
	value: TransactionKind;
}[] = [
	{ label: 'transactionKindExpense', value: TRANSACTION_KIND.EXPENSE },
	{ label: 'transactionKindIncome', value: TRANSACTION_KIND.INCOME },
];

const FREQUENCY_OPTIONS: readonly {
	label:
		| 'scheduledFrequencyDaily'
		| 'scheduledFrequencyMonthly'
		| 'scheduledFrequencyOnce'
		| 'scheduledFrequencyWeekly'
		| 'scheduledFrequencyYearly';
	value: ScheduledTransactionFrequency;
}[] = [
	{ label: 'scheduledFrequencyOnce', value: SCHEDULED_TRANSACTION_FREQUENCY.ONCE },
	{ label: 'scheduledFrequencyDaily', value: SCHEDULED_TRANSACTION_FREQUENCY.DAILY },
	{ label: 'scheduledFrequencyWeekly', value: SCHEDULED_TRANSACTION_FREQUENCY.WEEKLY },
	{ label: 'scheduledFrequencyMonthly', value: SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY },
	{ label: 'scheduledFrequencyYearly', value: SCHEDULED_TRANSACTION_FREQUENCY.YEARLY },
];

const POSTING_MODE_OPTIONS: readonly {
	label: 'scheduledModeAutomatic' | 'scheduledModeManual';
	value: ScheduledTransactionPostingMode;
}[] = [
	{ label: 'scheduledModeAutomatic', value: SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC },
	{ label: 'scheduledModeManual', value: SCHEDULED_TRANSACTION_POSTING_MODE.MANUAL },
];

const FORM_ID = 'scheduled-transaction-form';

function amountErrorMessage(
	copy: Copy,
	error: NonNullable<ScheduledTransactionFormProps['errors']['amount']>,
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

function ScheduledTransactionForm({
	amount,
	amountReference,
	categories,
	categoryId,
	closeEditor,
	copy,
	currencyCode,
	description,
	editingScheduleId,
	endDate,
	errors,
	feedback,
	frequency,
	interval,
	isEditorOpen,
	isSubmitting,
	kind,
	postingMode,
	setAmount,
	setCategoryId,
	setDescription,
	setEndDate,
	setFrequency,
	setInterval,
	setKind,
	setPostingMode,
	setStartDate,
	startDate,
	submit,
	today,
}: ScheduledTransactionFormProps): ReactElement {
	const isEditing = editingScheduleId !== undefined;
	const isOneTime = frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE;
	const isPastAutomaticStart =
		postingMode === SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC && startDate !== '' && startDate < today;
	const kindCategories = categories.filter(category => category.kind === kind);
	const amountHint = interpolate(copy.transactionAmountHint, {
		currency: currencyCode,
		digits: currencyFractionDigits(currencyCode),
	});
	const amountError = errors.amount ? amountErrorMessage(copy, errors.amount, currencyCode) : undefined;
	const dateError = errors.date ? copy.scheduledDateRequired : undefined;
	const descriptionError = errors.description ? copy.transactionDescriptionTooLong : undefined;
	const endDateError = errors.endDate
		? errors.endDate === 'range'
			? copy.scheduledEndDateRange
			: copy.scheduledEndDateInvalid
		: undefined;
	const intervalError = errors.interval ? copy.scheduledIntervalInvalid : undefined;
	const submitLabel = isSubmitting ? copy.scheduledSaving : isEditing ? copy.scheduledSave : copy.scheduledSubmit;
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
			description={isEditing ? copy.scheduledEditDescription : copy.scheduledFormDescription}
			footer={dialogFooter}
			id='scheduled-transaction-form-dialog'
			onClose={closeEditor}
			open={isEditorOpen}
			title={isEditing ? copy.scheduledEditTitle : copy.scheduledFormTitle}
			type={DIALOG_TYPE.STANDARD}>
			<form
				className={styles.form}
				id={FORM_ID}
				noValidate
				onSubmit={event => void submit(event)}>
				<fieldset className={styles.kind}>
					<legend className={styles.legend}>{copy.scheduledKindLabel}</legend>
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
						htmlFor='scheduled-transaction-amount'
						label={copy.transactionAmountLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('scheduled-transaction-amount', {
								error: amountError,
								hint: amountHint,
							})}
							autoComplete='off'
							data-autofocus
							id='scheduled-transaction-amount'
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
						htmlFor='scheduled-transaction-start-date'
						label={copy.scheduledStartDateLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('scheduled-transaction-start-date', {
								error: dateError,
							})}
							id='scheduled-transaction-start-date'
							invalid={Boolean(dateError)}
							name='startDate'
							onChange={setStartDate}
							size={TEXT_INPUT_SIZE.SMALL}
							type='date'
							value={startDate}
						/>
					</Field>
					<Field
						htmlFor='scheduled-transaction-frequency'
						label={copy.scheduledFrequencyLabel}>
						<Select
							id='scheduled-transaction-frequency'
							name='frequency'
							onChange={event => {
								setFrequency(event.currentTarget.value as ScheduledTransactionFrequency);
							}}
							size={SELECT_SIZE.SMALL}
							value={frequency}>
							{FREQUENCY_OPTIONS.map(option => (
								<option
									key={option.value}
									value={option.value}>
									{copy[option.label]}
								</option>
							))}
						</Select>
					</Field>
					{isOneTime ? undefined : (
						<Field
							error={intervalError}
							htmlFor='scheduled-transaction-interval'
							label={interpolate(copy.scheduledIntervalLabel, {
								unit: intervalUnitLabel(copy, frequency),
							})}>
							<TextInput
								aria-describedby={fieldDescriptionIds('scheduled-transaction-interval', {
									error: intervalError,
								})}
								id='scheduled-transaction-interval'
								inputMode='numeric'
								invalid={Boolean(intervalError)}
								max={999}
								min={1}
								name='interval'
								onChange={setInterval}
								size={TEXT_INPUT_SIZE.SMALL}
								type='number'
								value={interval}
							/>
						</Field>
					)}
					{isOneTime ? undefined : (
						<Field
							error={endDateError}
							hint={copy.scheduledEndDateHint}
							htmlFor='scheduled-transaction-end-date'
							label={copy.scheduledEndDateLabel}>
							<TextInput
								aria-describedby={fieldDescriptionIds('scheduled-transaction-end-date', {
									error: endDateError,
									hint: copy.scheduledEndDateHint,
								})}
								id='scheduled-transaction-end-date'
								invalid={Boolean(endDateError)}
								min={startDate || undefined}
								name='endDate'
								onChange={setEndDate}
								size={TEXT_INPUT_SIZE.SMALL}
								type='date'
								value={endDate}
							/>
						</Field>
					)}
					<Field
						htmlFor='scheduled-transaction-category'
						label={copy.transactionCategoryLabel}>
						<Select
							id='scheduled-transaction-category'
							name='categoryId'
							onChange={event => {
								setCategoryId(event.currentTarget.value);
							}}
							size={SELECT_SIZE.SMALL}
							value={categoryId}>
							<option value=''>{copy.transactionCategoryNone}</option>
							{kindCategories.map(category => (
								<option
									key={category.id}
									value={category.id}>
									{category.name}
								</option>
							))}
						</Select>
					</Field>
					<Field
						className={styles.full}
						error={descriptionError}
						hint={copy.transactionDescriptionHint}
						htmlFor='scheduled-transaction-description'
						label={copy.transactionDescriptionLabel}>
						<TextInput
							aria-describedby={fieldDescriptionIds('scheduled-transaction-description', {
								error: descriptionError,
								hint: copy.transactionDescriptionHint,
							})}
							autoComplete='off'
							id='scheduled-transaction-description'
							invalid={Boolean(descriptionError)}
							maxLength={DESCRIPTION_MAX_LENGTH}
							name='description'
							onChange={setDescription}
							size={TEXT_INPUT_SIZE.SMALL}
							value={description}
						/>
					</Field>
				</div>
				<fieldset className={styles.kind}>
					<legend className={styles.legend}>{copy.scheduledPostingModeLabel}</legend>
					<div className={styles.options}>
						{POSTING_MODE_OPTIONS.map(option => (
							<label
								className={styles.option}
								key={option.value}>
								<input
									checked={postingMode === option.value}
									className={styles.radio}
									name='postingMode'
									onChange={() => {
										setPostingMode(option.value);
									}}
									type='radio'
									value={option.value}
								/>
								<span className={styles.optionLabel}>{copy[option.label]}</span>
							</label>
						))}
					</div>
					<p className={styles.hint}>
						{postingMode === SCHEDULED_TRANSACTION_POSTING_MODE.AUTOMATIC
							? copy.scheduledPostingModeAutomaticHint
							: copy.scheduledPostingModeManualHint}
					</p>
				</fieldset>
				{isPastAutomaticStart ? (
					<Notice tone={NOTICE_TONE.WARNING}>{copy.scheduledPastStartWarning}</Notice>
				) : undefined}
				{isEditing ? <Notice>{copy.scheduledEditFutureWarning}</Notice> : undefined}
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

export { ScheduledTransactionForm };
