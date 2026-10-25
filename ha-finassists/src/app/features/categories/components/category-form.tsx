import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { TEXT_INPUT_SIZE, TextInput } from '@app/components/text-input';
import type { CategoryKind } from '@app/features/categories/categories-api';
import { CATEGORY_KIND } from '@app/features/categories/categories-api';
import { CATEGORY_NAME_MAX_LENGTH } from '@app/features/categories/categories-constants';
import type { CategoriesState } from '@app/features/categories/use-categories.hook';
import type { ReactElement } from 'react';

import styles from './category-form.module.css';

type CategoryFormProps = Pick<
	CategoriesState,
	| 'closeEditor'
	| 'copy'
	| 'editingCategoryId'
	| 'errors'
	| 'feedback'
	| 'isEditorOpen'
	| 'isSubmitting'
	| 'kind'
	| 'name'
	| 'setKind'
	| 'setName'
	| 'submit'
>;

const KIND_OPTIONS: readonly {
	label: 'transactionKindExpense' | 'transactionKindIncome';
	value: CategoryKind;
}[] = [
	{ label: 'transactionKindExpense', value: CATEGORY_KIND.EXPENSE },
	{ label: 'transactionKindIncome', value: CATEGORY_KIND.INCOME },
];

const FORM_ID = 'category-form';

function CategoryForm({
	closeEditor,
	copy,
	editingCategoryId,
	errors,
	feedback,
	isEditorOpen,
	isSubmitting,
	kind,
	name,
	setKind,
	setName,
	submit,
}: CategoryFormProps): ReactElement {
	const isEditing = editingCategoryId !== undefined;
	const nameError =
		errors.name === 'required'
			? copy.categoryNameRequired
			: errors.name === 'tooLong'
				? copy.categoryNameTooLong
				: undefined;
	const submitLabel = isSubmitting ? copy.categorySubmitting : isEditing ? copy.categorySave : copy.categoryCreate;
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
			description={isEditing ? copy.categoryEditDescription : copy.categoryFormDescription}
			footer={dialogFooter}
			id='category-form-dialog'
			onClose={closeEditor}
			open={isEditorOpen}
			title={isEditing ? copy.categoryEditTitle : copy.categoryFormTitle}
			type={DIALOG_TYPE.STANDARD}>
			<form
				className={styles.form}
				id={FORM_ID}
				noValidate
				onSubmit={event => void submit(event)}>
				<Field
					error={nameError}
					hint={copy.categoryNameHint}
					htmlFor='category-name'
					label={copy.categoryNameLabel}>
					<TextInput
						aria-describedby={fieldDescriptionIds('category-name', {
							error: nameError,
							hint: copy.categoryNameHint,
						})}
						autoComplete='off'
						data-autofocus
						id='category-name'
						invalid={Boolean(nameError)}
						maxLength={CATEGORY_NAME_MAX_LENGTH}
						name='name'
						onChange={setName}
						size={TEXT_INPUT_SIZE.SMALL}
						value={name}
					/>
				</Field>
				<fieldset className={styles.kind}>
					<legend className={styles.legend}>{copy.categoryKindLabel}</legend>
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

export { CategoryForm };
