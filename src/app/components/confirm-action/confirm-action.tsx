import type { ButtonSize, ButtonVariant } from '@app/components/button';
import { Button, BUTTON_SIZE, BUTTON_VARIANT } from '@app/components/button';
import { classNames } from '@app/components/class-names';
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './confirm-action.module.css';

interface ConfirmActionProps {
	cancelLabel: string;
	className?: string;
	disabled?: boolean;
	label: string;
	onConfirm: () => void;
	prompt: string;
	size?: ButtonSize;
	variant?: ButtonVariant;
}

function ConfirmAction({
	cancelLabel,
	className,
	disabled = false,
	label,
	onConfirm,
	prompt,
	size = BUTTON_SIZE.COMPACT,
	variant = BUTTON_VARIANT.SECONDARY,
}: ConfirmActionProps): ReactElement {
	const [confirming, setConfirming] = useState(false);

	return confirming ? (
		<div className={classNames(styles.confirming, className)}>
			<span
				className={styles.prompt}
				role='status'>
				{prompt}
			</span>
			<Button
				disabled={disabled}
				onClick={() => {
					onConfirm();
					setConfirming(false);
				}}
				size={size}
				type='button'
				variant={BUTTON_VARIANT.DANGER_CONFIRM}>
				{prompt}
			</Button>
			<Button
				onClick={() => setConfirming(false)}
				size={size}
				type='button'
				variant={BUTTON_VARIANT.SECONDARY}>
				{cancelLabel}
			</Button>
		</div>
	) : (
		<Button
			className={className}
			disabled={disabled}
			onClick={() => setConfirming(true)}
			size={size}
			type='button'
			variant={variant}>
			{label}
		</Button>
	);
}

export { ConfirmAction, type ConfirmActionProps };
