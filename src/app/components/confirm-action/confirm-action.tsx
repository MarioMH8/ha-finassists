import type { ButtonAppearance, ButtonSize, ButtonVariant } from '@app/components/button';
import { Button, BUTTON_APPEARANCE, BUTTON_SIZE, BUTTON_VARIANT } from '@app/components/button';
import type { ReactElement } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './confirm-action.module.css';

interface ConfirmActionProps {
	appearance?: ButtonAppearance;
	cancelLabel: string;
	className?: string;
	confirmLabel: string;
	disabled?: boolean;
	label: string;
	onConfirm: () => void;
	prompt: string;
	size?: ButtonSize;
	variant?: ButtonVariant;
}

/*
 * Destructive confirmation follows the Home Assistant dialog guidance: a native
 * modal dialog with a title, a description and only the two decision buttons.
 * https://contributors.home-assistant.io/design/components/dialog/
 */
function ConfirmAction({
	appearance = BUTTON_APPEARANCE.OUTLINED,
	cancelLabel,
	className,
	confirmLabel,
	disabled = false,
	label,
	onConfirm,
	prompt,
	size = BUTTON_SIZE.SMALL,
	variant = BUTTON_VARIANT.NEUTRAL,
}: ConfirmActionProps): ReactElement {
	const [open, setOpen] = useState(false);
	const dialogReference = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		const dialog = dialogReference.current;

		if (!dialog) {
			return;
		}

		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<>
			<Button
				appearance={appearance}
				className={className}
				disabled={disabled}
				onClick={() => setOpen(true)}
				size={size}
				type='button'
				variant={variant}>
				{label}
			</Button>
			<dialog
				aria-describedby={descriptionId}
				aria-labelledby={titleId}
				className={styles.dialog}
				onCancel={() => setOpen(false)}
				onClose={() => setOpen(false)}
				ref={dialogReference}>
				<div className={styles.body}>
					<h2
						className={styles.title}
						id={titleId}>
						{label}
					</h2>
					<p
						className={styles.description}
						id={descriptionId}>
						{prompt}
					</p>
				</div>
				<div className={styles.actions}>
					<Button
						onClick={() => setOpen(false)}
						size={BUTTON_SIZE.MEDIUM}
						type='button'>
						{cancelLabel}
					</Button>
					<Button
						appearance={BUTTON_APPEARANCE.FILLED}
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
						size={BUTTON_SIZE.MEDIUM}
						type='button'
						variant={BUTTON_VARIANT.DANGER}>
						{confirmLabel}
					</Button>
				</div>
			</dialog>
		</>
	);
}

export { ConfirmAction, type ConfirmActionProps };
