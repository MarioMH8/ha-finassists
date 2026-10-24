import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { TEXT_INPUT_SIZE, TextInput } from '@app/components/text-input';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './token-creation-form.module.css';

type TokenCreationFormProps = Pick<
	ApiTokenManagementState,
	'closeCreate' | 'copy' | 'createToken' | 'feedback' | 'isCreateOpen' | 'isCreating' | 'tokenNameReference'
>;

const FORM_ID = 'token-creation-form';

function TokenCreationForm({
	closeCreate,
	copy,
	createToken,
	feedback,
	isCreateOpen,
	isCreating,
	tokenNameReference,
}: TokenCreationFormProps): ReactElement {
	const dialogFooter = (
		<>
			<Button
				onClick={closeCreate}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.ACCENT}
				aria-busy={isCreating}
				disabled={isCreating}
				form={FORM_ID}
				type='submit'
				variant={BUTTON_VARIANT.BRAND}>
				{isCreating ? copy.creatingToken : copy.createToken}
			</Button>
		</>
	);

	return (
		<Dialog
			closeLabel={copy.close}
			description={copy.tokenCreateDescription}
			footer={dialogFooter}
			id='token-create-dialog'
			onClose={closeCreate}
			open={isCreateOpen}
			title={copy.createToken}
			type={DIALOG_TYPE.STANDARD}>
			<form
				className={styles.form}
				id={FORM_ID}
				onSubmit={event => void createToken(event)}>
				<Field
					hint={copy.tokenNameHint}
					htmlFor='token-name'
					label={copy.tokenNameLabel}>
					<TextInput
						aria-describedby={fieldDescriptionIds('token-name', { hint: copy.tokenNameHint })}
						autoComplete='off'
						data-autofocus
						id='token-name'
						maxLength={80}
						name='name'
						ref={tokenNameReference}
						required
						size={TEXT_INPUT_SIZE.SMALL}
					/>
				</Field>
				<div
					aria-atomic='true'
					aria-live='polite'
					className={styles.feedback}>
					{feedback.message ? (
						<Notice tone={feedback.state === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
							{feedback.message}
						</Notice>
					) : undefined}
				</div>
			</form>
		</Dialog>
	);
}

export { TokenCreationForm };
