import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Card, CARD_TONE } from '@app/components/card';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './issued-token-panel.module.css';

type IssuedTokenPanelProps = Pick<
	ApiTokenManagementState,
	'copy' | 'copyFeedback' | 'copyToken' | 'issuedSecret' | 'issuedTokenReference'
>;

function IssuedTokenPanel({
	copy,
	copyFeedback,
	copyToken,
	issuedSecret,
	issuedTokenReference,
}: IssuedTokenPanelProps): ReactElement {
	return (
		<Card
			aria-labelledby='issued-token-title'
			className={styles.panel}
			hidden={!issuedSecret}
			ref={issuedTokenReference}
			tabIndex={-1}
			tone={CARD_TONE.SUBTLE}>
			<SectionHeading
				level={3}
				title={copy.issuedTokenTitle}
				titleId='issued-token-title'
			/>
			<Notice tone={NOTICE_TONE.WARNING}>{copy.issuedTokenWarning}</Notice>
			<div className={styles.secret}>
				<code>{issuedSecret}</code>
				<Button
					appearance={BUTTON_APPEARANCE.FILLED}
					onClick={() => void copyToken()}
					type='button'
					variant={BUTTON_VARIANT.BRAND}>
					{copy.copyToken}
				</Button>
			</div>
			{copyFeedback.message ? (
				<Notice tone={copyFeedback.state === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
					{copyFeedback.message}
				</Notice>
			) : undefined}
		</Card>
	);
}

export { IssuedTokenPanel };
