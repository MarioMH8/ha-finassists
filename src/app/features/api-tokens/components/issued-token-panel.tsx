import { Button } from '@app/components/button';
import type { ReactElement } from 'react';

import styles from '../token-management.module.css';
import type { ApiTokenManagementState } from '../use-api-tokens.hook';

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
		<section
			aria-labelledby='issued-token-title'
			className={styles['issued-token']}
			hidden={!issuedSecret}
			ref={issuedTokenReference}
			tabIndex={-1}>
			<h3 id='issued-token-title'>{copy.issuedTokenTitle}</h3>
			<p>{copy.issuedTokenWarning}</p>
			<div className={styles['secret-field']}>
				<code>{issuedSecret}</code>
				<Button
					onClick={() => void copyToken()}
					type='button'>
					{copy.copyToken}
				</Button>
			</div>
		</section>
	);
}

export { IssuedTokenPanel };
