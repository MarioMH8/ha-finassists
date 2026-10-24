import type { BadgeTone } from '@app/components/badge';
import { Badge, BADGE_TONE } from '@app/components/badge';
import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Card, CARD_PADDING } from '@app/components/card';
import { Icon, ICON_NAME } from '@app/components/icon';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

import styles from './service-status-card.module.css';

type ServiceStatusCardProps = Pick<
	ApiTokenManagementState,
	'copy' | 'openCreate' | 'serviceMessage' | 'serviceState' | 'tokenCount'
>;

const SERVICE_TONE: Record<string, BadgeTone> = {
	error: BADGE_TONE.DANGER,
	ready: BADGE_TONE.SUCCESS,
};

function ServiceStatusCard({
	copy,
	openCreate,
	serviceMessage,
	serviceState,
	tokenCount,
}: ServiceStatusCardProps): ReactElement {
	return (
		<Card
			aria-labelledby='welcome-title'
			className={styles.card}
			padding={CARD_PADDING.LARGE}>
			<div className={styles.intro}>
				<span
					aria-hidden='true'
					className={styles.icon}>
					<Icon name={ICON_NAME.KEY} />
				</span>
				<div className={styles.introText}>
					<div className={styles.titleRow}>
						<h2 id='welcome-title'>{copy.welcome}</h2>
						<div
							aria-live='polite'
							role='status'>
							<Badge tone={SERVICE_TONE[serviceState] ?? BADGE_TONE.NEUTRAL}>{serviceMessage}</Badge>
						</div>
					</div>
					<p className={styles.description}>{copy.description}</p>
				</div>
			</div>
			<div className={styles.footer}>
				<p className={styles.metric}>
					<span className={styles.metricValue}>{tokenCount}</span>
					<span className={styles.metricLabel}>
						{tokenCount === 1 ? copy.activeToken : copy.activeTokens}
					</span>
				</p>
				<Button
					appearance={BUTTON_APPEARANCE.ACCENT}
					onClick={openCreate}
					type='button'
					variant={BUTTON_VARIANT.BRAND}>
					<Icon name={ICON_NAME.ADD} />
					{copy.createToken}
				</Button>
			</div>
		</Card>
	);
}

export { ServiceStatusCard };
