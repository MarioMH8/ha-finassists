import type { Copy } from '@app/i18n';
import type { ReactElement, SubmitEvent } from 'react';

interface ConfirmActionProps {
	cancelLabel: string;
	className?: string;
	disabled?: boolean;
	label: string;
	onConfirm: () => void;
	prompt: string;
}

interface ClassificationView {
	archivedAt: null | string;
	id: string;
	name: string;
	parentId: null | string;
}

type ClassificationViewKind = 'categories' | 'classes';

interface ClassificationsPanelProps {
	ConfirmAction: (props: ConfirmActionProps) => ReactElement;
	busy: boolean;
	categories: ClassificationView[];
	classes: ClassificationView[];
	copy: Copy;
	editingClassification: ClassificationView | undefined;
	isIncludeArchived: boolean;
	onCancelEdit: () => void;
	onEdit: (item: ClassificationView) => void;
	onIncludeArchivedChange: (isIncludeArchived: boolean) => void;
	onItemAction: (
		kind: ClassificationViewKind,
		item: ClassificationView,
		action: 'archive' | 'delete' | 'restore'
	) => void;
	onSubmit: (event: SubmitEvent<HTMLFormElement>, kind: ClassificationViewKind) => void;
	styles: Record<string, string>;
}

function ClassificationsPanel({
	busy,
	categories,
	classes,
	ConfirmAction,
	copy,
	editingClassification,
	isIncludeArchived,
	onCancelEdit,
	onEdit,
	onIncludeArchivedChange,
	onItemAction,
	onSubmit,
	styles,
}: ClassificationsPanelProps): ReactElement {
	return (
		<section className={styles['two-column']}>
			{(['categories', 'classes'] as const).map(kind => {
				const items = kind === 'categories' ? categories : classes;

				return (
					<div
						className={styles.card}
						key={kind}>
						<div className={styles['section-title']}>
							<div>
								<h3>{kind === 'categories' ? copy.financeCategories : copy.financeClasses}</h3>
								<p>{kind === 'categories' ? copy.financeCategoriesHelp : copy.financeClassesHelp}</p>
							</div>
							<label className={styles.check}>
								<input
									checked={isIncludeArchived}
									onChange={event => onIncludeArchivedChange(event.currentTarget.checked)}
									type='checkbox'
								/>
								{copy.financeIncludeArchived}
							</label>
						</div>
						<ul className={styles.list}>
							{items.map(item => (
								<li
									className={styles.row}
									key={item.id}>
									<div>
										<strong>{item.name}</strong>
										{item.archivedAt && (
											<span className={styles.badge}>{copy.financeArchived}</span>
										)}
									</div>
									<div className={styles['row-actions']}>
										{!item.archivedAt && (
											<button
												className={styles.secondary}
												disabled={busy}
												onClick={() => onEdit(item)}
												type='button'>
												{copy.financeEdit}
											</button>
										)}
										<button
											className={styles.secondary}
											disabled={busy}
											onClick={() =>
												onItemAction(kind, item, item.archivedAt ? 'restore' : 'archive')
											}
											type='button'>
											{item.archivedAt ? copy.financeRestore : copy.financeArchive}
										</button>
										<ConfirmAction
											cancelLabel={copy.cancel}
											className={styles.secondary}
											disabled={busy}
											label={copy.financeDelete}
											onConfirm={() => onItemAction(kind, item, 'delete')}
											prompt={copy.financeConfirmDelete}
										/>
									</div>
								</li>
							))}
						</ul>
						<form
							className={styles['stack-form']}
							key={`${kind}-${editingClassification?.id ?? 'new'}`}
							onSubmit={event => onSubmit(event, kind)}>
							<label>
								{editingClassification ? copy.financeEditName : copy.financeName}
								<input
									autoComplete='off'
									defaultValue={editingClassification?.name ?? ''}
									maxLength={80}
									name='name'
									required
								/>
							</label>
							<label>
								{copy.financeParent}
								<select
									defaultValue={editingClassification?.parentId ?? ''}
									name='parentId'>
									<option value=''>{copy.financeNoParent}</option>
									{items
										.filter(item => item.id !== editingClassification?.id && !item.archivedAt)
										.map(item => (
											<option
												key={item.id}
												value={item.id}>
												{item.name}
											</option>
										))}
								</select>
							</label>
							<div className={styles['row-actions']}>
								<button
									disabled={busy}
									type='submit'>
									{editingClassification ? copy.financeSave : copy.financeCreate}
								</button>
								{editingClassification && (
									<button
										className={styles.secondary}
										onClick={onCancelEdit}
										type='button'>
										{copy.cancel}
									</button>
								)}
							</div>
						</form>
					</div>
				);
			})}
		</section>
	);
}

export { ClassificationsPanel, type ClassificationView, type ClassificationViewKind };
