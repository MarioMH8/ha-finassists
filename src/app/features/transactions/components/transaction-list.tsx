import { Button, BUTTON_APPEARANCE, BUTTON_SIZE, BUTTON_VARIANT } from '@app/components/button';
import { Chip } from '@app/components/chip';
import { classNames } from '@app/components/class-names';
import { DATA_ALIGN, DataCell, DataHeaderCell, DataRowActions, DataTable } from '@app/components/data-table';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { EmptyState } from '@app/components/empty-state';
import { Field } from '@app/components/field';
import { Icon, ICON_NAME } from '@app/components/icon';
import { Menu, MENU_ITEM_TONE } from '@app/components/menu';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import { Select, SELECT_SIZE } from '@app/components/select';
import { TEXT_INPUT_SIZE, TextInput } from '@app/components/text-input';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { formatDate, formatMinorUnits } from '../transaction-amount';
import { TRANSACTION_KIND } from '../transactions-api';
import type { FilterKind, PageSize, TransactionFilters } from '../transactions-constants';
import { FILTER_KIND, LOAD_STATE, PAGE_SIZES } from '../transactions-constants';
import type { TransactionsState } from '../use-transactions.hook';
import styles from './transaction-list.module.css';

type TransactionListProps = Pick<
	TransactionsState,
	| 'applyFilters'
	| 'cancelDelete'
	| 'canGoNext'
	| 'canGoPrevious'
	| 'clearFilters'
	| 'confirmingTransactionId'
	| 'copy'
	| 'deleteSelectedTransactions'
	| 'deleteTransaction'
	| 'deletingTransactionId'
	| 'feedback'
	| 'filters'
	| 'goToNextPage'
	| 'goToPreviousPage'
	| 'hasFilters'
	| 'isEditorOpen'
	| 'language'
	| 'listReference'
	| 'listState'
	| 'openCreate'
	| 'openEdit'
	| 'pageCount'
	| 'pageIndex'
	| 'pageSize'
	| 'setConfirmingTransactionId'
	| 'setPageSize'
	| 'total'
	| 'transactions'
>;

const EMPTY_FILTERS: TransactionFilters = {
	fromDate: '',
	kind: FILTER_KIND.ALL,
	search: '',
	toDate: '',
};

function TransactionList({
	applyFilters,
	cancelDelete,
	canGoNext,
	canGoPrevious,
	clearFilters,
	confirmingTransactionId,
	copy,
	deleteSelectedTransactions,
	deleteTransaction,
	deletingTransactionId,
	feedback,
	filters,
	goToNextPage,
	goToPreviousPage,
	hasFilters,
	isEditorOpen,
	language,
	listReference,
	listState,
	openCreate,
	openEdit,
	pageCount,
	pageIndex,
	pageSize,
	setConfirmingTransactionId,
	setPageSize,
	total,
	transactions,
}: TransactionListProps): ReactElement {
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [draftFilters, setDraftFilters] = useState<TransactionFilters>(filters);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
	const [isDeletingSelected, setIsDeletingSelected] = useState(false);
	const selectAllReference = useRef<HTMLInputElement>(null);
	const transactionPendingDelete = transactions.find(transaction => transaction.id === confirmingTransactionId);
	const isDeleting = deletingTransactionId === transactionPendingDelete?.id;
	const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
	const rangeEnd = Math.min(total, (pageIndex + 1) * pageSize);
	const isListBusy = listState === LOAD_STATE.LOADING;
	const activeFilterCount =
		(filters.kind === FILTER_KIND.ALL ? 0 : 1) +
		(filters.fromDate === '' ? 0 : 1) +
		(filters.search === '' ? 0 : 1) +
		(filters.toDate === '' ? 0 : 1);
	const isDraftFiltered =
		draftFilters.kind !== FILTER_KIND.ALL ||
		draftFilters.fromDate !== '' ||
		draftFilters.search !== '' ||
		draftFilters.toDate !== '';
	const selectedCount = selectedIds.length;
	const isAllSelected = transactions.length > 0 && selectedCount === transactions.length;
	const isSomeSelected = selectedCount > 0 && !isAllSelected;

	useEffect(() => {
		setSelectedIds(current => current.filter(id => transactions.some(transaction => transaction.id === id)));
	}, [transactions]);

	useEffect(() => {
		if (selectAllReference.current) {
			selectAllReference.current.indeterminate = isSomeSelected;
		}
	}, [isSomeSelected]);

	function toggleSelected(transactionId: string): void {
		setSelectedIds(current =>
			current.includes(transactionId) ? current.filter(id => id !== transactionId) : [...current, transactionId]
		);
	}

	function toggleAllSelected(): void {
		setSelectedIds(isAllSelected ? [] : transactions.map(transaction => transaction.id));
	}

	async function confirmBulkDelete(): Promise<void> {
		setIsDeletingSelected(true);
		const deletedIds = await deleteSelectedTransactions(selectedIds);
		setIsDeletingSelected(false);
		setIsBulkDeleteOpen(false);
		if (deletedIds.length > 0) {
			setSelectedIds(current => current.filter(id => !deletedIds.includes(id)));
		}
	}
	const tableToolbar = (
		<div className={styles.toolbar}>
			<div className={styles.toolbarActions}>
				<Chip
					badge={activeFilterCount || undefined}
					icon={ICON_NAME.FILTER}
					onClick={() => {
						setDraftFilters(filters);
						setFiltersOpen(true);
					}}>
					{copy.transactionFilters}
				</Chip>
				{hasFilters && (
					<Button
						appearance={BUTTON_APPEARANCE.PLAIN}
						onClick={clearFilters}
						size={BUTTON_SIZE.SMALL}
						type='button'>
						{copy.transactionClearFilters}
					</Button>
				)}
			</div>
			<label className={styles.pageSize}>
				<span>{copy.transactionPageSize}</span>
				<Select
					className={styles.pageSizeSelect}
					onChange={event => {
						setPageSize(Number(event.currentTarget.value) as PageSize);
					}}
					size={SELECT_SIZE.EXTRA_SMALL}
					value={pageSize}>
					{PAGE_SIZES.map(size => (
						<option
							key={size}
							value={size}>
							{size}
						</option>
					))}
				</Select>
			</label>
		</div>
	);
	const selectionToolbar = (
		<div className={styles.selectionBar}>
			<p>{interpolate(copy.transactionSelectedCount, { count: selectedCount })}</p>
			<div className={styles.selectionActions}>
				<Button
					appearance={BUTTON_APPEARANCE.PLAIN}
					onClick={() => {
						setSelectedIds([]);
					}}
					size={BUTTON_SIZE.SMALL}
					type='button'>
					{copy.cancel}
				</Button>
				<Button
					appearance={BUTTON_APPEARANCE.FILLED}
					onClick={() => {
						setIsBulkDeleteOpen(true);
					}}
					size={BUTTON_SIZE.SMALL}
					type='button'
					variant={BUTTON_VARIANT.DANGER}>
					{copy.transactionDeleteSelected}
				</Button>
			</div>
		</div>
	);
	const filterDialogFooter = (
		<>
			<Button
				onClick={() => {
					setFiltersOpen(false);
				}}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.ACCENT}
				onClick={() => {
					applyFilters(draftFilters);
					setFiltersOpen(false);
				}}
				type='button'
				variant={BUTTON_VARIANT.BRAND}>
				{copy.transactionApplyFilters}
			</Button>
		</>
	);
	const newTransactionAction = (
		<Button
			appearance={BUTTON_APPEARANCE.ACCENT}
			onClick={openCreate}
			type='button'
			variant={BUTTON_VARIANT.BRAND}>
			{copy.transactionCreate}
		</Button>
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
					if (transactionPendingDelete) {
						void deleteTransaction(transactionPendingDelete);
					}
				}}
				size={BUTTON_SIZE.MEDIUM}
				type='button'
				variant={BUTTON_VARIANT.DANGER}>
				{isDeleting ? copy.transactionDeleting : copy.transactionDelete}
			</Button>
		</>
	);
	const bulkDeleteFooter = (
		<>
			<Button
				onClick={() => {
					setIsBulkDeleteOpen(false);
				}}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.FILLED}
				aria-busy={isDeletingSelected}
				disabled={isDeletingSelected}
				onClick={() => void confirmBulkDelete()}
				size={BUTTON_SIZE.MEDIUM}
				type='button'
				variant={BUTTON_VARIANT.DANGER}>
				{isDeletingSelected ? copy.transactionDeleting : copy.transactionDeleteSelected}
			</Button>
		</>
	);

	return (
		<section
			aria-labelledby='transaction-list-title'
			className={styles.section}>
			<SectionHeading
				actions={newTransactionAction}
				description={copy.transactionListDescription}
				title={copy.transactionListTitle}
				titleId='transaction-list-title'
			/>
			<div
				aria-busy={isListBusy || undefined}
				className={styles.content}>
				{listState === LOAD_STATE.ERROR ? (
					<Notice tone={NOTICE_TONE.ERROR}>{copy.transactionLoadError}</Notice>
				) : listState === LOAD_STATE.LOADING && transactions.length === 0 ? (
					<Notice>{copy.transactionLoading}</Notice>
				) : transactions.length === 0 ? (
					<EmptyState title={hasFilters ? copy.transactionEmptyFilteredTitle : copy.transactionEmptyTitle}>
						{hasFilters ? copy.transactionEmptyFilteredDescription : copy.transactionEmptyDescription}
					</EmptyState>
				) : (
					<>
						{feedback && !isEditorOpen ? (
							<Notice tone={feedback.tone === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
								{feedback.message}
							</Notice>
						) : undefined}
						<DataTable
							aria-busy={isListBusy || undefined}
							header={selectedCount > 0 ? selectionToolbar : tableToolbar}>
							<thead>
								<tr>
									<DataHeaderCell className={styles.selectionCell}>
										<input
											aria-label={copy.transactionSelectAll}
											checked={isAllSelected}
											className={styles.checkbox}
											onChange={toggleAllSelected}
											ref={selectAllReference}
											type='checkbox'
										/>
									</DataHeaderCell>
									<DataHeaderCell>{copy.transactionColumnDate}</DataHeaderCell>
									<DataHeaderCell>{copy.transactionColumnDescription}</DataHeaderCell>
									<DataHeaderCell align={DATA_ALIGN.END}>
										{copy.transactionColumnAmount}
									</DataHeaderCell>
									<DataHeaderCell align={DATA_ALIGN.END}>
										{copy.transactionColumnActions}
									</DataHeaderCell>
								</tr>
							</thead>
							<tbody ref={listReference}>
								{transactions.map(transaction => {
									const description = transaction.description || copy.transactionNoDescription;
									const isIncome = transaction.kind === TRANSACTION_KIND.INCOME;
									const signedMinor = isIncome ? transaction.amountMinor : -transaction.amountMinor;

									return (
										<tr
											className={classNames(
												selectedIds.includes(transaction.id) && styles.selectedRow
											)}
											key={transaction.id}>
											<DataCell className={styles.selectionCell}>
												<input
													aria-label={interpolate(copy.transactionSelect, {
														description,
													})}
													checked={selectedIds.includes(transaction.id)}
													className={styles.checkbox}
													onChange={() => {
														toggleSelected(transaction.id);
													}}
													type='checkbox'
												/>
											</DataCell>
											<DataCell className={styles.date}>
												<time dateTime={transaction.transactionDate}>
													{formatDate(transaction.transactionDate, language)}
												</time>
											</DataCell>
											<DataCell>
												{transaction.description || (
													<span className={styles.muted}>
														{copy.transactionNoDescription}
													</span>
												)}
											</DataCell>
											<DataCell
												className={classNames(isIncome ? styles.income : styles.expense)}
												numeric>
												{formatMinorUnits(
													signedMinor,
													transaction.currencyCode,
													language,
													'exceptZero'
												)}
											</DataCell>
											<DataCell
												align={DATA_ALIGN.END}
												className={styles.actions}>
												<DataRowActions>
													<Menu
														items={[
															{
																icon: ICON_NAME.EDIT,
																label: copy.transactionEdit,
																onSelect: () => {
																	openEdit(transaction);
																},
															},
															{
																icon: ICON_NAME.DELETE,
																label: copy.transactionDelete,
																onSelect: () => {
																	setConfirmingTransactionId(transaction.id);
																},
																tone: MENU_ITEM_TONE.DANGER,
															},
														]}
														label={interpolate(copy.transactionOptions, {
															description,
														})}
													/>
												</DataRowActions>
											</DataCell>
										</tr>
									);
								})}
							</tbody>
						</DataTable>
						<div className={styles.footer}>
							<p
								aria-live='polite'
								className={styles.count}>
								{interpolate(copy.transactionShowingRange, {
									from: rangeStart,
									to: rangeEnd,
									total,
								})}
							</p>
							<div className={styles.pager}>
								<Button
									appearance={BUTTON_APPEARANCE.PLAIN}
									aria-label={copy.transactionPrevious}
									disabled={!canGoPrevious || isListBusy}
									onClick={goToPreviousPage}
									size={BUTTON_SIZE.SMALL}
									title={copy.transactionPrevious}
									type='button'>
									<Icon name={ICON_NAME.CHEVRON_LEFT} />
								</Button>
								<span className={styles.pageIndicator}>
									{interpolate(copy.transactionPage, {
										page: pageIndex + 1,
										pages: pageCount,
									})}
								</span>
								<Button
									appearance={BUTTON_APPEARANCE.PLAIN}
									aria-label={copy.transactionNext}
									disabled={!canGoNext || isListBusy}
									onClick={goToNextPage}
									size={BUTTON_SIZE.SMALL}
									title={copy.transactionNext}
									type='button'>
									<Icon name={ICON_NAME.CHEVRON_RIGHT} />
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
			<Dialog
				closeLabel={copy.close}
				description={copy.transactionFiltersDescription}
				footer={filterDialogFooter}
				id='transaction-filters-dialog'
				onClose={() => {
					setFiltersOpen(false);
				}}
				open={filtersOpen}
				title={copy.transactionFiltersTitle}>
				<div className={styles.filterDialog}>
					<Field
						htmlFor='transaction-filter-search'
						label={copy.transactionFilterSearch}>
						<TextInput
							autoComplete='off'
							id='transaction-filter-search'
							onChange={event => {
								const search = event.currentTarget.value;
								setDraftFilters(current => ({
									...current,
									search,
								}));
							}}
							size={TEXT_INPUT_SIZE.SMALL}
							type='search'
							value={draftFilters.search}
						/>
					</Field>
					<Field
						htmlFor='transaction-filter-kind'
						label={copy.transactionFilterKind}>
						<Select
							id='transaction-filter-kind'
							onChange={event => {
								const kind = event.currentTarget.value as FilterKind;
								setDraftFilters(current => ({
									...current,
									kind,
								}));
							}}
							size={SELECT_SIZE.SMALL}
							value={draftFilters.kind}>
							<option value={FILTER_KIND.ALL}>{copy.transactionFilterAll}</option>
							<option value={TRANSACTION_KIND.EXPENSE}>{copy.transactionKindExpense}</option>
							<option value={TRANSACTION_KIND.INCOME}>{copy.transactionKindIncome}</option>
						</Select>
					</Field>
					<Field
						htmlFor='transaction-filter-from'
						label={copy.transactionFilterFrom}>
						<TextInput
							id='transaction-filter-from'
							max={draftFilters.toDate || undefined}
							onChange={event => {
								const fromDate = event.currentTarget.value;
								setDraftFilters(current => ({
									...current,
									fromDate,
								}));
							}}
							size={TEXT_INPUT_SIZE.SMALL}
							type='date'
							value={draftFilters.fromDate}
						/>
					</Field>
					<Field
						htmlFor='transaction-filter-to'
						label={copy.transactionFilterTo}>
						<TextInput
							id='transaction-filter-to'
							min={draftFilters.fromDate || undefined}
							onChange={event => {
								const toDate = event.currentTarget.value;
								setDraftFilters(current => ({
									...current,
									toDate,
								}));
							}}
							size={TEXT_INPUT_SIZE.SMALL}
							type='date'
							value={draftFilters.toDate}
						/>
					</Field>
					{isDraftFiltered && (
						<Button
							appearance={BUTTON_APPEARANCE.PLAIN}
							className={styles.clearDraftFilters}
							onClick={() => {
								setDraftFilters(EMPTY_FILTERS);
							}}
							type='button'>
							{copy.transactionClearFilters}
						</Button>
					)}
				</div>
			</Dialog>
			<Dialog
				closeLabel={copy.close}
				description={interpolate(copy.transactionDeleteSelectedPrompt, { count: selectedCount })}
				footer={bulkDeleteFooter}
				id='transaction-bulk-delete-dialog'
				onClose={() => {
					setIsBulkDeleteOpen(false);
				}}
				open={isBulkDeleteOpen}
				title={copy.transactionDeleteSelectedTitle}
				type={DIALOG_TYPE.ALERT}
			/>
			<Dialog
				closeLabel={copy.close}
				description={
					transactionPendingDelete
						? interpolate(copy.transactionDeletePrompt, {
								description: transactionPendingDelete.description || copy.transactionNoDescription,
							})
						: undefined
				}
				footer={confirmationFooter}
				id='transaction-delete-dialog'
				onClose={cancelDelete}
				open={transactionPendingDelete !== undefined}
				title={copy.transactionDeleteTitle}
				type={DIALOG_TYPE.ALERT}
			/>
		</section>
	);
}

export { TransactionList };
