import { Button } from '@app/components/button';
import type { ReactElement } from 'react';

import { ActiveTokenList, IssuedTokenPanel, ServiceStatusCard, TokenCreationForm } from './components';
import styles from './token-management.module.css';
import { useApiTokens } from './use-api-tokens.hook';

function TokenManagement(): ReactElement {
	const state = useApiTokens();
	const { copy } = state;

	return (
		<>
			<ServiceStatusCard
				copy={copy}
				serviceMessage={state.serviceMessage}
				serviceState={state.serviceState}
			/>
			<section
				aria-labelledby='tokens-title'
				className={styles['token-section']}>
				<div className={styles['section-heading']}>
					<div>
						<h2 id='tokens-title'>{copy.tokensTitle}</h2>
						<p>{copy.tokensDescription}</p>
					</div>
					<Button
						onClick={() => void state.loadTokens()}
						type='button'>
						{copy.refresh}
					</Button>
				</div>
				<TokenCreationForm
					copy={copy}
					createToken={state.createToken}
					feedback={state.feedback}
					isCreating={state.isCreating}
					tokenNameReference={state.tokenNameReference}
				/>
				<IssuedTokenPanel
					copy={copy}
					copyToken={state.copyToken}
					issuedSecret={state.issuedSecret}
					issuedTokenReference={state.issuedTokenReference}
				/>
				<ActiveTokenList
					cancelRevoke={state.cancelRevoke}
					confirmationReference={state.confirmationReference}
					confirmingTokenId={state.confirmingTokenId}
					copy={copy}
					revokeToken={state.revokeToken}
					setConfirmingTokenId={state.setConfirmingTokenId}
					tokenCount={state.tokenCount}
					tokenHeadingReference={state.tokenHeadingReference}
					tokenListReference={state.tokenListReference}
					tokenListStatusMessage={state.tokenListStatusMessage}
					tokens={state.tokens}
				/>
			</section>
			<footer>{copy.footer}</footer>
		</>
	);
}

export { TokenManagement };
