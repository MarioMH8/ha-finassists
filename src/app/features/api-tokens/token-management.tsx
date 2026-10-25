import type { ReactElement } from 'react';

import { ActiveTokenList, TokenCreationForm } from './components';
import styles from './token-management.module.css';
import { useApiTokens } from './use-api-tokens.hook';

function TokenManagement(): ReactElement {
	const state = useApiTokens();

	return (
		<>
			<ActiveTokenList
				cancelRevoke={state.cancelRevoke}
				confirmingTokenId={state.confirmingTokenId}
				copy={state.copy}
				feedback={state.feedback}
				isLoading={state.isLoading}
				listError={state.listError}
				openCreate={state.openCreate}
				revokeToken={state.revokeToken}
				revokingTokenId={state.revokingTokenId}
				serviceMessage={state.serviceMessage}
				serviceState={state.serviceState}
				setConfirmingTokenId={state.setConfirmingTokenId}
				tokenCount={state.tokenCount}
				tokenHeadingReference={state.tokenHeadingReference}
				tokenListReference={state.tokenListReference}
				tokens={state.tokens}
			/>
			<TokenCreationForm
				closeCreate={state.closeCreate}
				copy={state.copy}
				copyFeedback={state.copyFeedback}
				copyToken={state.copyToken}
				createToken={state.createToken}
				feedback={state.feedback}
				isCreateOpen={state.isCreateOpen}
				isCreating={state.isCreating}
				issuedSecret={state.issuedSecret}
				issuedTokenReference={state.issuedTokenReference}
				tokenNameReference={state.tokenNameReference}
			/>
			<footer className={styles.footer}>{state.copy.footer}</footer>
		</>
	);
}

export { TokenManagement };
