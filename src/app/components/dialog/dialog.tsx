import { Button, BUTTON_APPEARANCE, BUTTON_SIZE } from '@app/components/button';
import { classNames } from '@app/components/class-names';
import { Icon, ICON_NAME } from '@app/components/icon';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import styles from './dialog.module.css';

const DIALOG_TYPE = {
	ALERT: 'alert',
	STANDARD: 'standard',
} as const;

type DialogType = (typeof DIALOG_TYPE)[keyof typeof DIALOG_TYPE];

interface DialogProps {
	children?: ReactNode;
	closeLabel: string;
	description?: ReactNode;
	footer?: ReactNode;
	id: string;
	onClose: () => void;
	open: boolean;
	title: ReactNode;
	type?: DialogType;
}

/*
 * Native modal dialog following the Home Assistant guidance: a title, optional
 * description, scrollable body and the actions grouped in the footer.
 * https://contributors.home-assistant.io/design/components/dialog/
 */
function Dialog({
	children,
	closeLabel,
	description,
	footer,
	id,
	onClose,
	open,
	title,
	type = DIALOG_TYPE.STANDARD,
}: DialogProps): ReactElement {
	const dialogReference = useRef<HTMLDialogElement>(null);
	const titleId = `${id}-title`;
	const descriptionId = `${id}-description`;

	useEffect(() => {
		const dialog = dialogReference.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
			dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<dialog
			aria-describedby={description ? descriptionId : undefined}
			aria-labelledby={titleId}
			className={classNames(styles.dialog, styles[type])}
			onCancel={event => {
				event.preventDefault();
				onClose();
			}}
			onClick={event => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
			onClose={onClose}
			ref={dialogReference}>
			<header className={styles.header}>
				{type === DIALOG_TYPE.STANDARD ? (
					<Button
						appearance={BUTTON_APPEARANCE.PLAIN}
						aria-label={closeLabel}
						onClick={onClose}
						size={BUTTON_SIZE.MEDIUM}
						title={closeLabel}
						type='button'>
						<Icon name={ICON_NAME.CLOSE} />
					</Button>
				) : undefined}
				<div className={styles.heading}>
					<h2
						className={styles.title}
						id={titleId}>
						{title}
					</h2>
					{description ? (
						<p
							className={styles.description}
							id={descriptionId}>
							{description}
						</p>
					) : undefined}
				</div>
			</header>
			{children ? <div className={styles.body}>{children}</div> : undefined}
			{footer ? <footer className={styles.footer}>{footer}</footer> : undefined}
		</dialog>
	);
}

export { Dialog, DIALOG_TYPE, type DialogType };
