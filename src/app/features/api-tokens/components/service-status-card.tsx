import styles from '@app/features/api-tokens/token-management.module.css';
import type { ApiTokenManagementState } from '@app/features/api-tokens/use-api-tokens.hook';
import type { ReactElement } from 'react';

type ServiceStatusCardProps = Pick<ApiTokenManagementState, 'copy' | 'serviceMessage' | 'serviceState'>;

function ServiceStatusCard({ copy, serviceMessage, serviceState }: ServiceStatusCardProps): ReactElement {
	return (
		<section
			aria-labelledby='welcome-title'
			className={styles['welcome-card']}>
			<h2 id='welcome-title'>{copy.welcome}</h2>
			<p>{copy.description}</p>
			<div
				aria-live='polite'
				className={styles['service-status']}
				data-state={serviceState === 'checking' ? undefined : serviceState}
				role='status'>
				<span
					aria-hidden='true'
					className={styles['status-indicator']}
				/>
				<span>{serviceMessage}</span>
			</div>
		</section>
	);
}

export { ServiceStatusCard };
