import { Button, BUTTON_APPEARANCE, BUTTON_SIZE } from '@app/components/button';
import { classNames } from '@app/components/class-names';
import type { IconName } from '@app/components/icon';
import { Icon, ICON_NAME } from '@app/components/icon';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './menu.module.css';

const MENU_ITEM_TONE = {
	DANGER: 'danger',
	DEFAULT: 'default',
} as const;

type MenuItemTone = (typeof MENU_ITEM_TONE)[keyof typeof MENU_ITEM_TONE];

interface MenuItem {
	disabled?: boolean;
	icon?: IconName;
	label: string;
	onSelect: () => void;
	tone?: MenuItemTone;
}

interface MenuProps {
	items: readonly MenuItem[];
	label: string;
}

interface MenuPosition {
	bottom?: number;
	right: number;
	top?: number;
}

/*
 * Overflow menu modelled after the Home Assistant dropdown: a three-dot trigger
 * with a keyboard-navigable menu of actions.
 * https://contributors.home-assistant.io/design/components/dropdown/
 */
function Menu({ items, label }: MenuProps): ReactElement {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<MenuPosition>({ right: 10, top: 0 });
	const triggerReference = useRef<HTMLButtonElement>(null);
	const menuReference = useRef<HTMLDivElement>(null);
	const menuId = useId();

	function closeMenu(): void {
		setOpen(false);
		triggerReference.current?.focus();
	}

	function openMenu(): void {
		const rect = triggerReference.current?.getBoundingClientRect();
		if (!rect) {
			return;
		}
		setPosition({ right: Math.max(10, window.innerWidth - rect.right), top: rect.bottom + 4 });
		setOpen(true);
	}

	useEffect(() => {
		if (!open) {
			return;
		}
		const menu = menuReference.current;
		const trigger = triggerReference.current;
		if (!menu || !trigger) {
			return;
		}
		const place = (): void => {
			const triggerRect = trigger.getBoundingClientRect();
			const menuRect = menu.getBoundingClientRect();
			const isOpensUp =
				triggerRect.bottom + menuRect.height + 8 > window.innerHeight && triggerRect.top >= menuRect.height + 8;
			setPosition({
				right: Math.max(10, window.innerWidth - triggerRect.right),
				...(isOpensUp
					? { bottom: window.innerHeight - triggerRect.top + 4, top: undefined }
					: { bottom: undefined, top: triggerRect.bottom + 4 }),
			});
		};
		place();
		menu.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();

		const handlePointerDown = (event: PointerEvent): void => {
			const target = event.target;
			if (target instanceof Node && !menu.contains(target) && !trigger.contains(target)) {
				setOpen(false);
			}
		};
		document.addEventListener('pointerdown', handlePointerDown);
		// A fixed menu must follow its trigger while the page or an inner panel scrolls.
		// eslint-disable-next-line unicorn/prefer-observer-apis -- Continuously repositioning is the point.
		window.addEventListener('resize', place);
		// eslint-disable-next-line unicorn/prefer-observer-apis -- Continuously repositioning is the point.
		window.addEventListener('scroll', place, { capture: true });

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', place, true);
		};
	}, [open]);

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
		const menuItems = [
			...(menuReference.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []),
		];
		const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault();
				menuItems[(currentIndex + 1) % menuItems.length]?.focus();
				break;
			}
			case 'ArrowUp': {
				event.preventDefault();
				menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length]?.focus();
				break;
			}
			case 'End': {
				event.preventDefault();
				menuItems.at(-1)?.focus();
				break;
			}
			case 'Escape': {
				event.preventDefault();
				closeMenu();
				break;
			}
			case 'Home': {
				event.preventDefault();
				menuItems[0]?.focus();
				break;
			}
			case 'Tab': {
				event.preventDefault();
				closeMenu();
				break;
			}
			default: {
				break;
			}
		}
	}

	const menuStyle: CSSProperties = position;

	return (
		<>
			<Button
				appearance={BUTTON_APPEARANCE.PLAIN}
				aria-controls={open ? menuId : undefined}
				aria-expanded={open}
				aria-haspopup='menu'
				aria-label={label}
				onClick={() => {
					if (open) {
						closeMenu();
					} else {
						openMenu();
					}
				}}
				onKeyDown={event => {
					if (event.key !== 'ArrowDown') {
						return;
					}

					event.preventDefault();
					openMenu();
				}}
				ref={triggerReference}
				size={BUTTON_SIZE.SMALL}
				title={label}
				type='button'>
				<Icon name={ICON_NAME.MORE_VERT} />
			</Button>
			{open &&
				createPortal(
					<div
						aria-label={label}
						className={styles.menu}
						id={menuId}
						onKeyDown={handleKeyDown}
						ref={menuReference}
						role='menu'
						style={menuStyle}>
						{items.map((item, index) => (
							<button
								aria-disabled={item.disabled ? true : undefined}
								aria-posinset={index + 1}
								aria-setsize={items.length}
								className={classNames(
									styles.item,
									item.tone === MENU_ITEM_TONE.DANGER && styles.danger
								)}
								disabled={item.disabled}
								key={item.label}
								onClick={() => {
									closeMenu();
									item.onSelect();
								}}
								role='menuitem'
								tabIndex={-1}
								type='button'>
								{item.icon ? <Icon name={item.icon} /> : undefined}
								<span>{item.label}</span>
							</button>
						))}
					</div>,
					document.body
				)}
		</>
	);
}

export { Menu, MENU_ITEM_TONE, type MenuItem, type MenuItemTone };
