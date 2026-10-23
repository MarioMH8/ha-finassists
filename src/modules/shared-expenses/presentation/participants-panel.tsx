import type { ReactElement, SubmitEvent } from 'react';
import { useState } from 'react';

import styles from './shared-expenses.module.css';
import type { SharedExpensesCopy } from './shared-expenses-copy';
import type { CreateParticipantInput, Participant } from './shared-expenses-model';

interface ParticipantsPanelProps {
	busy: boolean;
	copy: SharedExpensesCopy;
	includeRemoved: boolean;
	onCreate: (input: CreateParticipantInput) => Promise<boolean>;
	onRemove: (participantId: string) => Promise<boolean>;
	participants: Participant[];
	setIncludeRemoved: (shouldInclude: boolean) => void;
}

function ParticipantsPanel({
	busy,
	copy,
	includeRemoved,
	onCreate,
	onRemove,
	participants,
	setIncludeRemoved,
}: ParticipantsPanelProps): ReactElement {
	const [pendingRemoval, setPendingRemoval] = useState<string | undefined>();
	const activeParticipants = participants.filter(participant => participant.removedAt === undefined);

	async function submitParticipant(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		const nameValue = values.get('name');
		const name = typeof nameValue === 'string' ? nameValue.trim() : '';
		const idValue = values.get('id');
		const id = typeof idValue === 'string' ? idValue.trim() : '';
		if (!name || !id) {
			return;
		}
		if (await onCreate({ id, name })) {
			form.reset();
		}
	}

	async function confirmRemoval(participantId: string): Promise<void> {
		if (await onRemove(participantId)) {
			setPendingRemoval(undefined);
		}
	}

	return (
		<div className={styles['people-layout']}>
			<section
				aria-labelledby='shared-expense-person-form-title'
				className={styles.panel}>
				<div className={styles['section-heading']}>
					<h3 id='shared-expense-person-form-title'>{copy.addParticipant}</h3>
					<p>{copy.participantIdHint}</p>
				</div>
				<form
					className={styles['participant-form']}
					onSubmit={event => void submitParticipant(event)}>
					<label>
						{copy.name}
						<input
							autoComplete='off'
							maxLength={120}
							name='name'
							placeholder={copy.namePlaceholder}
							required
						/>
					</label>
					<label>
						{copy.participantId}
						<input
							autoComplete='off'
							maxLength={120}
							name='id'
							pattern='[^\s]+'
							placeholder={copy.participantIdPlaceholder}
							required
							title={copy.participantIdHint}
						/>
					</label>
					<button
						aria-busy={busy}
						disabled={busy}
						type='submit'>
						{copy.addParticipant}
					</button>
				</form>
			</section>

			<section
				aria-labelledby='shared-expense-people-title'
				className={styles.panel}>
				<div className={styles['section-heading']}>
					<div>
						<h3 id='shared-expense-people-title'>{copy.participantManagement}</h3>
						<p>
							{activeParticipants.length} {copy.participantList.toLocaleLowerCase()}
						</p>
					</div>
					<label className={styles['toggle-label']}>
						<input
							checked={includeRemoved}
							onChange={event => setIncludeRemoved(event.currentTarget.checked)}
							type='checkbox'
						/>
						{copy.includeRemoved}
					</label>
				</div>
				{participants.length === 0 ? (
					<p className={styles.empty}>{copy.noParticipantsYet}</p>
				) : (
					<ul className={styles['people-list']}>
						{participants.map(participant => {
							const isRemoved = participant.removedAt !== undefined;
							const isConfirming = pendingRemoval === participant.id;

							return (
								<li
									className={styles.person}
									key={participant.id}>
									<div className={styles['person-identity']}>
										<strong>{participant.name}</strong>
										<code>{participant.id}</code>
										<span className={isRemoved ? styles['status-muted'] : styles['status-active']}>
											{isRemoved ? copy.participantRemoved : copy.participantStatus}
										</span>
									</div>
									{!isRemoved && (
										<div className={styles['person-actions']}>
											{isConfirming ? (
												<>
													<span className={styles['confirm-copy']}>
														{copy.participantRemoveConfirm}
													</span>
													<button
														className={styles.secondary}
														disabled={busy}
														onClick={() => void confirmRemoval(participant.id)}
														type='button'>
														{copy.removeConfirm}
													</button>
													<button
														className={styles.tertiary}
														onClick={() => setPendingRemoval(undefined)}
														type='button'>
														{copy.participantRemoveCancel}
													</button>
												</>
											) : (
												<button
													className={styles.tertiary}
													disabled={busy}
													onClick={() => setPendingRemoval(participant.id)}
													type='button'>
													{copy.participantRemove}
												</button>
											)}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}

export { ParticipantsPanel };
