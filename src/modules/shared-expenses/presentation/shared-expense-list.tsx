import type { Language } from '@app/i18n/language';
import type { ReactElement } from 'react';

import styles from './shared-expenses.module.css';
import type { SharedExpensesCopy } from './shared-expenses-copy';
import type { Actor, SharedExpense } from './shared-expenses-model';
import { ACTOR_KIND, formatDate, formatMinorUnits, SETTLEMENT_STATUS } from './shared-expenses-model';

interface SharedExpenseListProps {
	busy: boolean;
	copy: SharedExpensesCopy;
	currencyCode: string;
	expenses: SharedExpense[];
	language: Language;
	onClose: (expenseId: string) => void;
	onReopen: (expenseId: string) => void;
	onSettle: (expenseId: string, participantId: string) => void;
}

function actorLabel(actor: Actor, copy: SharedExpensesCopy): string {
	if (actor.kind === ACTOR_KIND.UNKNOWN) {
		return copy.unknownActor;
	}
	const actorType = actor.kind === ACTOR_KIND.HOME_ASSISTANT_USER ? copy.actorUser : copy.actorIntegration;

	return actor.id ? `${actorType} · ${actor.id}` : actorType;
}

function SharedExpenseList({
	busy,
	copy,
	currencyCode,
	expenses,
	language,
	onClose,
	onReopen,
	onSettle,
}: SharedExpenseListProps): ReactElement {
	if (expenses.length === 0) {
		return <p className={styles.empty}>{copy.expenseEmpty}</p>;
	}

	return (
		<ul className={styles['expense-list']}>
			{expenses.map(expense => {
				const isClosed = expense.closedAt !== undefined;
				const unsettled = expense.settlements.filter(
					settlement => settlement.status === SETTLEMENT_STATUS.PENDING
				).length;

				return (
					<li
						className={styles.expense}
						key={expense.id}>
						<div className={styles['expense-heading']}>
							<div className={styles['expense-title']}>
								<h4>{expense.description}</h4>
								<p>
									{copy.createdAt} ·{' '}
									<time dateTime={expense.createdAt}>{formatDate(expense.createdAt, language)}</time>
								</p>
							</div>
							<div className={styles['expense-total']}>
								<strong>{formatMinorUnits(expense.amountMinor, currencyCode, language)}</strong>
								<span className={isClosed ? styles['status-muted'] : styles['status-active']}>
									{isClosed ? copy.closed : copy.open}
								</span>
							</div>
						</div>

						<div className={styles['expense-details']}>
							<span>
								{copy.actor}: <strong>{actorLabel(expense.actor, copy)}</strong>
							</span>
							<span>{copy.shareEqual}</span>
						</div>
						<div className={styles['settlement-heading']}>
							<h5>{copy.settlements}</h5>
							<span>
								{expense.settlements.length - unsettled}/{expense.settlements.length}{' '}
								{copy.settled.toLocaleLowerCase()}
							</span>
						</div>
						<ul className={styles['settlement-list']}>
							{expense.allocations.map(allocation => {
								const settlement = expense.settlements.find(
									item => item.participantId === allocation.participantId
								);
								const isSettled = settlement?.status === SETTLEMENT_STATUS.SETTLED;
								const settled =
									settlement?.status === SETTLEMENT_STATUS.SETTLED ? settlement : undefined;
								const settledByActor = settled?.settledByActor;

								return (
									<li
										className={styles.settlement}
										key={allocation.participantId}>
										<div className={styles['settlement-person']}>
											<strong>{allocation.participantName}</strong>
											<span>
												{copy.share} ·{' '}
												{formatMinorUnits(allocation.amountMinor, currencyCode, language)}
											</span>
										</div>
										<div className={styles['settlement-action']}>
											<span
												className={
													isSettled ? styles['status-active'] : styles['status-pending']
												}>
												{isSettled ? copy.settled : copy.pending}
											</span>
											{!isSettled && !isClosed && (
												<button
													className={styles.tertiary}
													disabled={busy}
													onClick={() => onSettle(expense.id, allocation.participantId)}
													type='button'>
													{copy.settle}
												</button>
											)}
										</div>
										{settledByActor && (
											<p className={styles['settled-by']}>
												{copy.settlementBy} {actorLabel(settledByActor, copy)}
												{settled.settledAt && (
													<>
														{' '}
														·{' '}
														<time dateTime={settled.settledAt}>
															{formatDate(settled.settledAt, language)}
														</time>
													</>
												)}
											</p>
										)}
									</li>
								);
							})}
						</ul>

						<div className={styles['expense-actions']}>
							{isClosed ? (
								<>
									<p>{copy.closedHint}</p>
									<button
										className={styles.secondary}
										disabled={busy}
										onClick={() => onReopen(expense.id)}
										type='button'>
										{copy.reopen}
									</button>
								</>
							) : (
								<button
									className={styles.secondary}
									disabled={busy}
									onClick={() => onClose(expense.id)}
									type='button'>
									{copy.close}
								</button>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export { SharedExpenseList };
