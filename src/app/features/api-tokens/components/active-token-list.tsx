import { Button, BUTTON_VARIANT } from '@app/components/button';
import { List, ListItem } from '@app/components/list';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import { formatTokenDate } from '@app/features/api-tokens/use-api-tokens.hook';
import { formatTokenCount } from '@app/i18n';
import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement } from 'react';

import styles from './active-token-list.module.css';

type ActiveTokenListProps = Pick<
	ApiTokenManagementState,
	| 'cancelRevoke'
	| 'confirmationReference'
	| 'confirmingTokenId'
	| 'copy'
	| 'revokeToken'
	| 'setConfirmingTokenId'
	| 'tokenCount'
	| 'tokenHeadingReference'
	| 'tokenListReference'
	| 'tokenListStatusMessage'
	| 'tokens'
>;

function ActiveTokenList({
	cancelRevoke,
	confirmationReference,
	confirmingTokenId,
	copy,
	revokeToken,
	setConfirmingTokenId,
	tokenCount,
	tokenHeadingReference,
	tokenListReference,
	tokenListStatusMessage,
	tokens,
}: ActiveTokenListProps): ReactElement {
	const { language } = useLocale();

	return (
		<>
			<div className={styles.heading}>
				<h3
					ref={tokenHeadingReference}
					tabIndex={-1}>
					{copy.activeTokens}
				</h3>
				<p>{formatTokenCount(tokenCount, language)}</p>
			</div>
			<p
				className={styles.state}
				hidden={!tokenListStatusMessage}>
				{tokenListStatusMessage}
			</p>
			<List
				aria-label={copy.activeTokens}
				ref={tokenListReference}>
				{tokens.map(token => (
					<ListItem
						actions={
							confirmingTokenId === token.id ? (
								<>
									<Button
										aria-label={`${copy.confirmRevoke}: ${token.name}`}
										onClick={() => void revokeToken(token)}
										ref={confirmationReference}
										type='button'
										variant={BUTTON_VARIANT.DANGER_CONFIRM}>
										{copy.confirmRevoke}
									</Button>
									<Button
										onClick={() => cancelRevoke(token.id)}
										type='button'>
										{copy.cancel}
									</Button>
								</>
							) : (
								<Button
									data-token-id={token.id}
									onClick={() => setConfirmingTokenId(token.id)}
									type='button'
									variant={BUTTON_VARIANT.DANGER}>
									{copy.revoke}
								</Button>
							)
						}
						key={token.id}>
						<div className={styles.details}>
							<strong>{token.name}</strong>
							<span>
								{token.prefix} · {formatTokenDate(token.createdAt, language)}
							</span>
						</div>
					</ListItem>
				))}
			</List>
		</>
	);
}

export { ActiveTokenList };
