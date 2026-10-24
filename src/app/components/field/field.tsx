import { classNames } from '@app/components/class-names';
import type { ReactElement, ReactNode } from 'react';

import styles from './field.module.css';

interface FieldProps {
	children: ReactNode;
	className?: string;
	error?: ReactNode;
	hint?: ReactNode;
	htmlFor: string;
	label: ReactNode;
}

function fieldDescriptionIds(id: string, { error, hint }: { error?: unknown; hint?: unknown }): string | undefined {
	const ids = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined].filter(Boolean);

	return ids.length > 0 ? ids.join(' ') : undefined;
}

function Field({ children, className, error, hint, htmlFor, label }: FieldProps): ReactElement {
	return (
		<div className={classNames(styles.field, className)}>
			<label
				className={styles.label}
				htmlFor={htmlFor}>
				{label}
			</label>
			{hint ? (
				<p
					className={styles.hint}
					id={`${htmlFor}-hint`}>
					{hint}
				</p>
			) : undefined}
			{children}
			{error ? (
				<p
					className={styles.error}
					id={`${htmlFor}-error`}
					role='alert'>
					{error}
				</p>
			) : undefined}
		</div>
	);
}

export { Field, fieldDescriptionIds };
