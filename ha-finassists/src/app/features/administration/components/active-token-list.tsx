import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Card } from '@app/components/card';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { EmptyState } from '@app/components/empty-state';
import { ICON_NAME } from '@app/components/icon';
import { List, ListItem } from '@app/components/list';
import { Menu, MENU_ITEM_TONE } from '@app/components/menu';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import type { AdministrationState } from '@app/features/administration/use-administration.hook';
import { formatTokenDate } from '@app/features/administration/use-administration.hook';
import { formatTokenCount, interpolate } from '@app/i18n';
import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement } from 'react';

import styles from './active-token-list.module.css';

type ActiveTokenListProps = Pick<
	AdministrationState,
	| 'cancelRevoke'
	| 'confirmingTokenId'
	| 'copy'
	| 'feedback'
	| 'isLoading'
	| 'listError'
	| 'openCreate'
	| 'revokeToken'
	| 'revokingTokenId'
	| 'serviceMessage'
	| 'serviceState'
	| 'setConfirmingTokenId'
	| 'tokenCount'
	| 'tokenHeadingReference'
	| 'tokenListReference'
	| 'tokens'
>;

function ActiveTokenList({
	cancelRevoke,
	confirmingTokenId,
	copy,
	feedback,
	isLoading,
	listError,
	openCreate,
	revokeToken,
	revokingTokenId,
	serviceMessage,
	serviceState,
	setConfirmingTokenId,
	tokenCount,
	tokenHeadingReference,
	tokenListReference,
	tokens,
}: ActiveTokenListProps): ReactElement {
	const { language } = useLocale();
	const pendingToken = tokens.find(token => token.id === confirmingTokenId);
	const isRevoking = revokingTokenId === pendingToken?.id;

	const confirmationFooter = (
		<>
			<Button
				onClick={() => {
					if (pendingToken) {
						cancelRevoke(pendingToken.id);
					}
				}}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.FILLED}
				aria-busy={isRevoking}
				disabled={isRevoking}
				onClick={() => {
					if (pendingToken) {
						void revokeToken(pendingToken);
					}
				}}
				type='button'
				variant={BUTTON_VARIANT.DANGER}>
				{isRevoking ? copy.revokingToken : copy.revoke}
			</Button>
		</>
	);

	const headingDescription = (
		<span className={styles.description}>
			<span
				aria-hidden='true'
				className={styles.status}
				data-state={serviceState}
			/>
			{serviceMessage} · {formatTokenCount(tokenCount, language)}
		</span>
	);
	const headingActions = (
		<Button
			appearance={BUTTON_APPEARANCE.ACCENT}
			onClick={openCreate}
			type='button'
			variant={BUTTON_VARIANT.BRAND}>
			{copy.createToken}
		</Button>
	);

	return (
		<>
			<section
				aria-labelledby='active-tokens-title'
				className={styles.section}>
				<SectionHeading
					actions={headingActions}
					description={headingDescription}
					title={copy.activeTokens}
					titleId='active-tokens-title'
					titleRef={tokenHeadingReference}
				/>
				<Card bleed>
					<div className={styles.body}>
						{feedback.message ? (
							<Notice tone={feedback.state === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
								{feedback.message}
							</Notice>
						) : undefined}
						{listError ? (
							<Notice tone={NOTICE_TONE.ERROR}>{copy.errorLoadingTokens}</Notice>
						) : isLoading && tokens.length === 0 ? (
							<Notice>{copy.loadingTokens}</Notice>
						) : tokens.length === 0 ? (
							<EmptyState
								icon={ICON_NAME.WALLET}
								title={copy.tokensEmptyTitle}>
								{copy.noTokens}
							</EmptyState>
						) : (
							<List
								aria-label={copy.activeTokens}
								ref={tokenListReference}>
								{tokens.map(token => {
									const actions = (
										<span
											className={styles.menu}
											data-token-id={token.id}>
											<Menu
												items={[
													{
														icon: ICON_NAME.DELETE,
														label: copy.revoke,
														onSelect: () => {
															setConfirmingTokenId(token.id);
														},
														tone: MENU_ITEM_TONE.DANGER,
													},
												]}
												label={interpolate(copy.tokenOptions, { name: token.name })}
											/>
										</span>
									);

									return (
										<ListItem
											actions={actions}
											key={token.id}>
											<div className={styles.details}>
												<strong>{token.name}</strong>
												<span>
													{token.prefix} · {formatTokenDate(token.createdAt, language)}
												</span>
											</div>
										</ListItem>
									);
								})}
							</List>
						)}
					</div>
				</Card>
			</section>
			<Dialog
				closeLabel={copy.close}
				description={
					pendingToken ? interpolate(copy.revokeTokenPrompt, { name: pendingToken.name }) : undefined
				}
				footer={confirmationFooter}
				id='revoke-token-dialog'
				onClose={() => {
					if (pendingToken) {
						cancelRevoke(pendingToken.id);
					}
				}}
				open={pendingToken !== undefined}
				title={copy.revokeTokenTitle}
				type={DIALOG_TYPE.ALERT}
			/>
		</>
	);
}

export { ActiveTokenList };
