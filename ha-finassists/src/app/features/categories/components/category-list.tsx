import { Badge, BADGE_TONE } from '@app/components/badge';
import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Card } from '@app/components/card';
import { DATA_ALIGN, DataCell, DataHeaderCell, DataRowActions, DataTable } from '@app/components/data-table';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { EmptyState } from '@app/components/empty-state';
import { Field } from '@app/components/field';
import { ICON_NAME } from '@app/components/icon';
import { Menu, MENU_ITEM_TONE } from '@app/components/menu';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import { Select, SELECT_SIZE } from '@app/components/select';
import { CATEGORY_KIND } from '@app/features/categories/categories-api';
import type { CategoryFilter } from '@app/features/categories/categories-constants';
import { CATEGORY_FILTER, LOAD_STATE } from '@app/features/categories/categories-constants';
import type { CategoriesState } from '@app/features/categories/use-categories.hook';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './category-list.module.css';

type CategoryListProps = Pick<
	CategoriesState,
	| 'cancelDelete'
	| 'categories'
	| 'confirmingCategoryId'
	| 'copy'
	| 'deleteCategory'
	| 'deletingCategoryId'
	| 'feedback'
	| 'filterKind'
	| 'isEditorOpen'
	| 'listState'
	| 'openCreate'
	| 'openEdit'
	| 'setConfirmingCategoryId'
	| 'setFilterKind'
>;

function CategoryList({
	cancelDelete,
	categories,
	confirmingCategoryId,
	copy,
	deleteCategory,
	deletingCategoryId,
	feedback,
	filterKind,
	isEditorOpen,
	listState,
	openCreate,
	openEdit,
	setConfirmingCategoryId,
	setFilterKind,
}: CategoryListProps): ReactElement {
	const pendingCategory = categories.find(category => category.id === confirmingCategoryId);
	const isDeleting = deletingCategoryId === pendingCategory?.id;
	const hasFilter = filterKind !== CATEGORY_FILTER.ALL;
	const newCategoryAction = (
		<Button
			appearance={BUTTON_APPEARANCE.ACCENT}
			onClick={openCreate}
			type='button'
			variant={BUTTON_VARIANT.BRAND}>
			{copy.categoryCreate}
		</Button>
	);
	const filterToolbar = (
		<div className={styles.toolbar}>
			<Field
				htmlFor='category-filter-kind'
				label={copy.categoryFilterKind}>
				<Select
					id='category-filter-kind'
					onChange={event => {
						setFilterKind(event.currentTarget.value as CategoryFilter);
					}}
					size={SELECT_SIZE.SMALL}
					value={filterKind}>
					<option value={CATEGORY_FILTER.ALL}>{copy.categoryFilterAll}</option>
					<option value={CATEGORY_KIND.EXPENSE}>{copy.transactionKindExpense}</option>
					<option value={CATEGORY_KIND.INCOME}>{copy.transactionKindIncome}</option>
				</Select>
			</Field>
		</div>
	);
	const confirmationFooter = (
		<>
			<Button
				onClick={cancelDelete}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.FILLED}
				aria-busy={isDeleting}
				disabled={isDeleting}
				onClick={() => {
					if (pendingCategory) {
						void deleteCategory(pendingCategory);
					}
				}}
				type='button'
				variant={BUTTON_VARIANT.DANGER}>
				{isDeleting ? copy.categoryDeleting : copy.categoryDelete}
			</Button>
		</>
	);

	return (
		<section
			aria-labelledby='category-list-title'
			className={styles.section}>
			<SectionHeading
				actions={newCategoryAction}
				description={copy.categoryListDescription}
				title={copy.categoryListTitle}
				titleId='category-list-title'
			/>
			{feedback && !isEditorOpen ? (
				<Notice tone={feedback.tone === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
					{feedback.message}
				</Notice>
			) : undefined}
			{listState === LOAD_STATE.ERROR ? (
				<Notice tone={NOTICE_TONE.ERROR}>{copy.categoryLoadError}</Notice>
			) : listState === LOAD_STATE.LOADING && categories.length === 0 ? (
				<Notice>{copy.categoryLoading}</Notice>
			) : categories.length === 0 ? (
				<Card bleed>
					{hasFilter ? <div className={styles.cardHeader}>{filterToolbar}</div> : undefined}
					<EmptyState
						icon={ICON_NAME.TAG}
						title={hasFilter ? copy.categoryEmptyFilteredTitle : copy.categoryEmptyTitle}>
						{hasFilter ? copy.categoryEmptyFilteredDescription : copy.categoryEmptyDescription}
					</EmptyState>
				</Card>
			) : (
				<DataTable header={filterToolbar}>
					<thead>
						<tr>
							<DataHeaderCell>{copy.categoryColumnName}</DataHeaderCell>
							<DataHeaderCell>{copy.categoryColumnKind}</DataHeaderCell>
							<DataHeaderCell align={DATA_ALIGN.END}>{copy.categoryColumnTransactions}</DataHeaderCell>
							<DataHeaderCell align={DATA_ALIGN.END}>{copy.categoryColumnActions}</DataHeaderCell>
						</tr>
					</thead>
					<tbody>
						{categories.map(category => (
							<tr key={category.id}>
								<DataCell className={styles.name}>{category.name}</DataCell>
								<DataCell>
									<Badge
										tone={
											category.kind === CATEGORY_KIND.INCOME
												? BADGE_TONE.SUCCESS
												: BADGE_TONE.NEUTRAL
										}>
										{category.kind === CATEGORY_KIND.INCOME
											? copy.transactionKindIncome
											: copy.transactionKindExpense}
									</Badge>
								</DataCell>
								<DataCell numeric>
									{category.transactionCount}
									{category.scheduledTransactionCount > 0 ? (
										<span className={styles.scheduledCount}>
											{interpolate(copy.categoryScheduledCount, {
												count: category.scheduledTransactionCount,
											})}
										</span>
									) : undefined}
								</DataCell>
								<DataCell
									align={DATA_ALIGN.END}
									className={styles.actions}>
									<DataRowActions>
										<Menu
											items={[
												{
													icon: ICON_NAME.EDIT,
													label: copy.categoryEdit,
													onSelect: () => {
														openEdit(category);
													},
												},
												...(category.transactionCount === 0 &&
												category.scheduledTransactionCount === 0
													? [
															{
																icon: ICON_NAME.DELETE,
																label: copy.categoryDelete,
																onSelect: () => {
																	setConfirmingCategoryId(category.id);
																},
																tone: MENU_ITEM_TONE.DANGER,
															},
														]
													: []),
											]}
											label={interpolate(copy.categoryOptions, { name: category.name })}
										/>
									</DataRowActions>
								</DataCell>
							</tr>
						))}
					</tbody>
				</DataTable>
			)}
			<Dialog
				closeLabel={copy.close}
				description={
					pendingCategory ? interpolate(copy.categoryDeletePrompt, { name: pendingCategory.name }) : undefined
				}
				footer={confirmationFooter}
				id='category-delete-dialog'
				onClose={cancelDelete}
				open={confirmingCategoryId !== undefined}
				title={copy.categoryDeleteTitle}
				type={DIALOG_TYPE.STANDARD}>
				<p>{copy.categoryDeleteDescription}</p>
			</Dialog>
		</section>
	);
}

export { CategoryList };
