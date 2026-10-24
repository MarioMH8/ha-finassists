import { Button } from '@app/components/button';
import { Card, CARD_TONE } from '@app/components/card';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './issued-token-panel.module.css';

type IssuedTokenPanelProps = Pick<
	ApiTokenManagementState,
	'copy' | 'copyToken' | 'issuedSecret' | 'issuedTokenReference'
>;

function IssuedTokenPanel({
	copy,
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
			<h3 id='issued-token-title'>{copy.issuedTokenTitle}</h3>
			<p className={styles.warning}>{copy.issuedTokenWarning}</p>
			<div className={styles.secret}>
				<code>{issuedSecret}</code>
				<Button
					onClick={() => void copyToken()}
					type='button'>
					{copy.copyToken}
				</Button>
			</div>
		</Card>
	);
}

export { IssuedTokenPanel };
