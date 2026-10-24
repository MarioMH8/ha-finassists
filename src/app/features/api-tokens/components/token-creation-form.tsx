import { Button, BUTTON_VARIANT } from '@app/components/button';
import { Field, fieldDescriptionIds } from '@app/components/field';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { TextInput } from '@app/components/text-input';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './token-creation-form.module.css';

type TokenCreationFormProps = Pick<
	ApiTokenManagementState,
	'copy' | 'createToken' | 'feedback' | 'isCreating' | 'tokenNameReference'
>;

function TokenCreationForm({
	copy,
	createToken,
	feedback,
	isCreating,
	tokenNameReference,
}: TokenCreationFormProps): ReactElement {
	return (
		<>
			<form
				className={styles.form}
				onSubmit={event => void createToken(event)}>
				<Field
					className={styles.field}
					hint={copy.tokenNameHint}
					htmlFor='token-name'
					label={copy.tokenNameLabel}>
					<TextInput
						aria-describedby={fieldDescriptionIds('token-name', { hint: copy.tokenNameHint })}
						autoComplete='off'
						id='token-name'
						maxLength={80}
						name='name'
						ref={tokenNameReference}
						required
					/>
				</Field>
				<Button
					aria-busy={isCreating}
					disabled={isCreating}
					type='submit'
					variant={BUTTON_VARIANT.PRIMARY}>
					{isCreating ? copy.creatingToken : copy.createToken}
				</Button>
			</form>
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
		</>
	);
}

export { TokenCreationForm };
