import { List, ListItem } from '@app/components/list';
import { LoadingStatus, Skeleton, SKELETON_SHAPE } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './active-token-list.module.css';

const SKELETON_TOKENS = ['token-1', 'token-2', 'token-3'];

interface ActiveTokenListSkeletonProps {
	copy: Copy;
}

function ActiveTokenListSkeleton({ copy }: ActiveTokenListSkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.loadingTokens} />
			<List aria-hidden='true'>
				{SKELETON_TOKENS.map(token => (
					<ListItem
						actions={<Skeleton shape={SKELETON_SHAPE.CIRCLE} />}
						key={token}>
						<div className={styles.details}>
							<Skeleton className={styles.nameSkeleton} />
							<Skeleton className={styles.metaSkeleton} />
						</div>
					</ListItem>
				))}
			</List>
		</>
	);
}

export { ActiveTokenListSkeleton };
