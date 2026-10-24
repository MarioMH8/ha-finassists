import type { BadgeTone } from '@app/components/badge';
import { Badge, BADGE_TONE } from '@app/components/badge';
import { Card, CARD_PADDING } from '@app/components/card';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './service-status-card.module.css';

type ServiceStatusCardProps = Pick<ApiTokenManagementState, 'copy' | 'serviceMessage' | 'serviceState'>;

const SERVICE_TONE: Record<string, BadgeTone> = {
	error: BADGE_TONE.DANGER,
	ready: BADGE_TONE.SUCCESS,
};

function ServiceStatusCard({ copy, serviceMessage, serviceState }: ServiceStatusCardProps): ReactElement {
	return (
		<Card
			aria-labelledby='welcome-title'
			className={styles.card}
			padding={CARD_PADDING.LARGE}>
			<h2 id='welcome-title'>{copy.welcome}</h2>
			<p className={styles.description}>{copy.description}</p>
			<div
				aria-live='polite'
				role='status'>
				<Badge tone={SERVICE_TONE[serviceState] ?? BADGE_TONE.NEUTRAL}>{serviceMessage}</Badge>
			</div>
		</Card>
	);
}

export { ServiceStatusCard };
