import type { ReactElement } from 'react';

import { ActiveTokenList, IssuedTokenPanel, ServiceStatusCard, TokenCreationForm } from './components';
import styles from './token-management.module.css';
import { useApiTokens } from './use-api-tokens.hook';

function TokenManagement(): ReactElement {
	const state = useApiTokens();

	return (
		<>
			<ServiceStatusCard
				copy={state.copy}
				openCreate={state.openCreate}
				serviceMessage={state.serviceMessage}
				serviceState={state.serviceState}
				tokenCount={state.tokenCount}
			/>
			<IssuedTokenPanel
				copy={state.copy}
				copyFeedback={state.copyFeedback}
				copyToken={state.copyToken}
				issuedSecret={state.issuedSecret}
				issuedTokenReference={state.issuedTokenReference}
			/>
			<ActiveTokenList
				cancelRevoke={state.cancelRevoke}
				confirmingTokenId={state.confirmingTokenId}
				copy={state.copy}
				feedback={state.feedback}
				isLoading={state.isLoading}
				listError={state.listError}
				revokeToken={state.revokeToken}
				revokingTokenId={state.revokingTokenId}
				setConfirmingTokenId={state.setConfirmingTokenId}
				tokenCount={state.tokenCount}
				tokenHeadingReference={state.tokenHeadingReference}
				tokenListReference={state.tokenListReference}
				tokens={state.tokens}
			/>
			<TokenCreationForm
				closeCreate={state.closeCreate}
				copy={state.copy}
				createToken={state.createToken}
				feedback={state.feedback}
				isCreateOpen={state.isCreateOpen}
				isCreating={state.isCreating}
				tokenNameReference={state.tokenNameReference}
			/>
			<footer className={styles.footer}>{state.copy.footer}</footer>
		</>
	);
}

export { TokenManagement };
