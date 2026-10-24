import { classNames } from '@app/components/class-names';
import type { ReactElement, SVGProps } from 'react';

import styles from './icon.module.css';

const ICON_NAME = {
	CHECK: 'check',
	CLOSE: 'close',
	DELETE: 'delete',
} as const;

type IconName = (typeof ICON_NAME)[keyof typeof ICON_NAME];

const ICON_PATH: Record<IconName, string> = {
	check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
	close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
	delete: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
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
