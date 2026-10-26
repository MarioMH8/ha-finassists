import { classNames } from '@app/components/class-names';
import type { ReactElement, SVGProps } from 'react';

import styles from './icon.module.css';

const ICON_NAME = {
	CHART: 'chart',
	CHECK: 'check',
	CHEVRON_DOWN: 'chevronDown',
	CHEVRON_LEFT: 'chevronLeft',
	CHEVRON_RIGHT: 'chevronRight',
	CLOSE: 'close',
	DELETE: 'delete',
	EDIT: 'edit',
	FILTER: 'filter',
	MORE_VERT: 'moreVert',
	RECEIPT: 'receipt',
	TAG: 'tag',
	WALLET: 'wallet',
} as const;

type IconName = (typeof ICON_NAME)[keyof typeof ICON_NAME];

const ICON_PATH: Record<IconName, string> = {
	chart: 'M3,3H5V19H21V21H3V3M7,17V10H9V17H7M11,17V6H13V17H11M15,17V13H17V17H15Z',
	check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
	chevronDown: 'M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z',
	chevronLeft: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
	chevronRight: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
	close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
	delete: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
	edit: 'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z',
	filter: 'M3,2H21V4L14,11V20.5L10,18.5V11L3,4V2Z',
	moreVert:
		'M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z',
	receipt:
		'M19.5 3.5L18 2L16.5 3.5L15 2L13.5 3.5L12 2L10.5 3.5L9 2L7.5 3.5L6 2L4.5 3.5L3 2V22L4.5 20.5L6 22L7.5 20.5L9 22L10.5 20.5L12 22L13.5 20.5L15 22L16.5 20.5L18 22L19.5 20.5L21 22V2L19.5 3.5M19 19H5V5H19V19M6 15H18V17H6M6 11H18V13H6M6 7H18V9H6V7Z',
	tag: 'M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z',
	wallet: 'M5,3C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V16.72C21.59,16.37 22,15.74 22,15V9C22,8.26 21.59,7.63 21,7.28V5A2,2 0 0,0 19,3H5M5,5H19V7H13A2,2 0 0,0 11,9V15A2,2 0 0,0 13,17H19V19H5V5M13,9H20V15H13V9M16,10.5A1.5,1.5 0 0,0 14.5,12A1.5,1.5 0 0,0 16,13.5A1.5,1.5 0 0,0 17.5,12A1.5,1.5 0 0,0 16,10.5Z',
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
	name: IconName;
}

function Icon({ className, name, ...props }: IconProps): ReactElement {
	return (
		<svg
			aria-hidden='true'
			className={classNames(styles.icon, className)}
			fill='currentColor'
			viewBox='0 0 24 24'
			{...props}>
			<path d={ICON_PATH[name]} />
		</svg>
	);
}

export { Icon, ICON_NAME, type IconName };
