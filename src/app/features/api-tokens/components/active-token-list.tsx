import { Button, BUTTON_VARIANT } from '@app/components/button';
import styles from '@app/features/api-tokens/token-management.module.css';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import { formatTokenDate } from '@app/features/api-tokens/use-api-tokens.hook';
import { formatTokenCount } from '@app/i18n';
import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement } from 'react';

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
			<div className={styles['token-list-heading']}>
				<h3
					ref={tokenHeadingReference}
					tabIndex={-1}>
					{copy.activeTokens}
				</h3>
				<p>{formatTokenCount(tokenCount, language)}</p>
			</div>
			<p
				className={styles['token-list-state']}
				hidden={!tokenListStatusMessage}>
				{tokenListStatusMessage}
			</p>
			<ul
				aria-label={copy.activeTokens}
				className={styles['token-list']}
				ref={tokenListReference}>
				{tokens.map(token => (
					<li
						className={styles['token-item']}
						key={token.id}>
						<div className={styles['token-details']}>
							<strong>{token.name}</strong>
							<span>
								{token.prefix} · {formatTokenDate(token.createdAt, language)}
							</span>
						</div>
						<div className={styles['token-actions']}>
							{confirmingTokenId === token.id ? (
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
							)}
						</div>
					</li>
				))}
			</ul>
		</>
	);
}

export { ActiveTokenList };
