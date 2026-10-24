import { Button, BUTTON_VARIANT } from '@app/components/button';
import styles from '@app/features/api-tokens/token-management.module.css';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

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
				className={styles['token-form']}
				onSubmit={event => void createToken(event)}>
				<div className={styles['form-field']}>
					<label htmlFor='token-name'>{copy.tokenNameLabel}</label>
					<p
						className={styles['field-hint']}
						id='token-name-hint'>
						{copy.tokenNameHint}
					</p>
					<input
						aria-describedby='token-name-hint'
						autoComplete='off'
						id='token-name'
						maxLength={80}
						name='name'
						ref={tokenNameReference}
						required
						type='text'
					/>
				</div>
				<Button
					aria-busy={isCreating}
					disabled={isCreating}
					type='submit'
					variant={BUTTON_VARIANT.PRIMARY}>
					{isCreating ? copy.creatingToken : copy.createToken}
				</Button>
			</form>
			<p
				aria-atomic='true'
				aria-live='polite'
				className={styles['token-feedback']}
				data-state={feedback.state}
				role='status'>
				{feedback.message}
			</p>
		</>
	);
}

export { TokenCreationForm };
