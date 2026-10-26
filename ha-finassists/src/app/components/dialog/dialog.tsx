import { Button, BUTTON_APPEARANCE, BUTTON_SIZE } from '@app/components/button';
import { classNames } from '@app/components/class-names';
import { Icon, ICON_NAME } from '@app/components/icon';
import { clearIngressFrameOutline } from '@app/shell/ingress-frame';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import styles from './dialog.module.css';

const DIALOG_TYPE = {
	ALERT: 'alert',
	STANDARD: 'standard',
} as const;

const FALLBACK_FOCUS_SELECTOR = '#main-content';

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
 * WebKit can leave focus on the parent page when a native dialog closes. Moving
 * it back inside this document keeps keyboard navigation and the Ingress iframe
 * outline in the state the app expects.
 */
function restoreFocus(opener: HTMLElement | undefined): void {
	requestAnimationFrame(() => {
		focus();
		if (opener?.isConnected === true) {
			opener.focus();
		} else {
			document.querySelector<HTMLElement>(FALLBACK_FOCUS_SELECTOR)?.focus();
		}
		/*
		 * Moving focus back lets Home Assistant paint the iframe outline again,
		 * so clear it once focus is inside this document.
		 */
		clearIngressFrameOutline();
	});
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
			restoreFocus(opener);
		}
	}, [open]);

	useEffect(() => {
		const dialog = dialogReference.current;

		return () => {
			/*
			 * The passive cleanup runs after the ref is detached, so the dialog
			 * captured at mount is the only way to tell whether it was still open.
			 */
			if (!dialog?.open) {
				return;
			}
			dialog.close();
			restoreFocus(openerReference.current);
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
				/*
				 * Calling `dialog.close()` emits a native close event. The `open`
				 * prop already asked for that close, so only a close the app did
				 * not initiate should reach `onClose`.
				 */
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
