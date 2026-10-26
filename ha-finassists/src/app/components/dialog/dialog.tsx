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

const FALLBACK_FOCUS_SELECTOR = '#page-title';

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

function hasDialogFocus(activeElement: Element | null, dialog: HTMLDialogElement): boolean {
	return (
		activeElement === null ||
		activeElement === document.body ||
		activeElement === document.documentElement ||
		dialog.contains(activeElement)
	);
}

function restoreFocus(opener: HTMLElement | undefined, dialog: HTMLDialogElement): void {
	requestAnimationFrame(() => {
		if (opener?.isConnected === true) {
			opener.focus();
		} else if (hasDialogFocus(document.activeElement, dialog)) {
			document.querySelector<HTMLElement>(FALLBACK_FOCUS_SELECTOR)?.focus();
		}
	});
}

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
	const openerReference = useRef<HTMLElement | undefined>(undefined);
	const titleId = `${id}-title`;
	const descriptionId = `${id}-description`;

	useEffect(() => {
		const dialog = dialogReference.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			const activeElement = document.activeElement;
			openerReference.current =
				activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : undefined;
			dialog.showModal();
			dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
			const opener = openerReference.current;
			openerReference.current = undefined;
			restoreFocus(opener, dialog);
		}
	}, [open]);

	useEffect(() => {
		const dialog = dialogReference.current;

		return () => {
			if (!dialog?.open) {
				return;
			}
			dialog.close();
			restoreFocus(openerReference.current, dialog);
		};
	}, []);

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
			onClose={() => {
				if (open) {
					onClose();
				}
			}}
			ref={dialogReference}>
			<header className={styles.header}>
				{type === DIALOG_TYPE.STANDARD ? (
					<Button
						appearance={BUTTON_APPEARANCE.PLAIN}
						aria-label={closeLabel}
						className={styles.closeButton}
						onClick={onClose}
						size={BUTTON_SIZE.LARGE}
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
