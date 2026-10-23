import {
	SharedExpenseActorIdInvalidError,
	SharedExpenseActorInvalidError,
	SharedExpenseAllocationsInvalidError,
	SharedExpenseAllocationTotalMismatchError,
	SharedExpenseAmountInvalidError,
	SharedExpenseAmountNonPositiveError,
	SharedExpenseBookIdInvalidError,
	SharedExpenseDescriptionInvalidError,
	SharedExpenseIdInvalidError,
	SharedExpenseParticipantBookMismatchError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantsDuplicateError,
	SharedExpenseParticipantsMissingError,
	SharedExpenseSettlementsInvalidError,
	SharedExpenseSettlementStatusInvalidError,
	SharedExpenseSettlementTransitionInvalidError,
	SharedExpenseTransitionInvalidError,
} from './shared-expense.error';

const SHARED_EXPENSE_ACTOR_KIND = {
	HOME_ASSISTANT_INTEGRATION: 'home_assistant_integration',
	HOME_ASSISTANT_USER: 'home_assistant_user',
	UNKNOWN: 'unknown',
} as const;

const SHARED_EXPENSE_SETTLEMENT_STATUS = {
	PENDING: 'pending',
	SETTLED: 'settled',
} as const;

type SharedExpenseActorKind = (typeof SHARED_EXPENSE_ACTOR_KIND)[keyof typeof SHARED_EXPENSE_ACTOR_KIND];
type SharedExpenseSettlementStatus =
	(typeof SHARED_EXPENSE_SETTLEMENT_STATUS)[keyof typeof SHARED_EXPENSE_SETTLEMENT_STATUS];

interface HomeAssistantSharedExpenseActor {
	readonly id: string;
	readonly kind: typeof SHARED_EXPENSE_ACTOR_KIND.HOME_ASSISTANT_USER;
}

interface HomeAssistantIntegrationSharedExpenseActor {
	readonly id: string;
	readonly kind: typeof SHARED_EXPENSE_ACTOR_KIND.HOME_ASSISTANT_INTEGRATION;
}

interface UnknownSharedExpenseActor {
	readonly kind: typeof SHARED_EXPENSE_ACTOR_KIND.UNKNOWN;
}

type SharedExpenseActor =
	HomeAssistantIntegrationSharedExpenseActor | HomeAssistantSharedExpenseActor | UnknownSharedExpenseActor;

interface SharedExpenseAllocation {
	readonly amountMinor: number;
	readonly participantId: string;
	readonly participantName: string;
}

interface SharedExpenseSettlement {
	readonly amountMinor: number;
	readonly participantId: string;
	readonly settledAt?: string;
	readonly settledByActor?: SharedExpenseActor;
	readonly status: SharedExpenseSettlementStatus;
}

interface SharedExpenseParticipantDetails {
	readonly bookId: string;
	readonly id: string;
	readonly name: string;
	readonly removedAt?: string;
}

interface SharedExpenseProperties {
	readonly actor: SharedExpenseActor;
	readonly allocations: readonly SharedExpenseAllocation[];
	readonly amountMinor: number;
	readonly bookId: string;
	readonly closedAt?: string;
	readonly createdAt: string;
	readonly description: string;
	readonly id: string;
	readonly settlements: readonly SharedExpenseSettlement[];
}

interface BuildSharedExpenseInput {
	readonly actor: SharedExpenseActor;
	readonly amountMinor: number;
	readonly bookId: string;
	readonly createdAt?: string;
	readonly description: string;
	readonly id: string;
	readonly participants: readonly SharedExpenseParticipantDetails[];
}

class SharedExpense {
	readonly actor: SharedExpenseActor;
	readonly allocations: readonly SharedExpenseAllocation[];
	readonly amountMinor: number;
	readonly bookId: string;
	readonly closedAt?: string;
	readonly createdAt: string;
	readonly description: string;
	readonly id: string;
	readonly settlements: readonly SharedExpenseSettlement[];

	private constructor(properties: SharedExpenseProperties) {
		this.actor = properties.actor;
		this.allocations = properties.allocations;
		this.amountMinor = properties.amountMinor;
		this.bookId = properties.bookId;
		this.closedAt = properties.closedAt;
		this.createdAt = properties.createdAt;
		this.description = properties.description;
		this.id = properties.id;
		this.settlements = properties.settlements;
		Object.freeze(this);
	}

	static create(input: BuildSharedExpenseInput): SharedExpense {
		if (input.id.trim().length === 0) {
			throw new SharedExpenseIdInvalidError();
		}
		if (input.bookId.trim().length === 0) {
			throw new SharedExpenseBookIdInvalidError();
		}
		if (input.description.trim().length === 0 || input.description.trim().length > 200) {
			throw new SharedExpenseDescriptionInvalidError();
		}
		const id = input.id.trim();
		const bookId = input.bookId.trim();
		const description = input.description.trim();
		if (!Number.isSafeInteger(input.amountMinor)) {
			throw new SharedExpenseAmountInvalidError();
		}
		if (input.amountMinor <= 0) {
			throw new SharedExpenseAmountNonPositiveError();
		}
		if (input.participants.length === 0) {
			throw new SharedExpenseParticipantsMissingError();
		}
		if (new Set(input.participants.map(participant => participant.id)).size !== input.participants.length) {
			throw new SharedExpenseParticipantsDuplicateError();
		}
		for (const participant of input.participants) {
			if (participant.bookId !== bookId) {
				throw new SharedExpenseParticipantBookMismatchError();
			}
			if (participant.removedAt !== undefined) {
				throw new SharedExpenseParticipantInactiveError(participant.id);
			}
		}

		const orderedParticipants = input.participants.toSorted((left, right) => left.id.localeCompare(right.id, 'en'));
		const divisor = BigInt(orderedParticipants.length);
		const amount = BigInt(input.amountMinor);
		const baseShare = Number(amount / divisor);
		const remainder = Number(amount % divisor);
		const allocations = orderedParticipants.map((participant, index) => ({
			amountMinor: baseShare + (index < remainder ? 1 : 0),
			participantId: participant.id,
			participantName: participant.name,
		}));

		return this.restore({
			actor: input.actor,
			allocations,
			amountMinor: input.amountMinor,
			bookId,
			createdAt: input.createdAt ?? new Date().toISOString(),
			description,
			id,
			settlements: allocations.map(allocation => ({
				amountMinor: allocation.amountMinor,
				participantId: allocation.participantId,
				status: SHARED_EXPENSE_SETTLEMENT_STATUS.PENDING,
			})),
		});
	}

	static normalizeActor(actor: SharedExpenseActor): SharedExpenseActor {
		return this.freezeActor(actor);
	}

	static restore(properties: SharedExpenseProperties): SharedExpense {
		if (properties.id.trim().length === 0) {
			throw new SharedExpenseIdInvalidError();
		}
		if (properties.bookId.trim().length === 0) {
			throw new SharedExpenseBookIdInvalidError();
		}
		if (properties.description.trim().length === 0 || properties.description.trim().length > 200) {
			throw new SharedExpenseDescriptionInvalidError();
		}
		if (!Number.isSafeInteger(properties.amountMinor)) {
			throw new SharedExpenseAmountInvalidError();
		}
		if (properties.amountMinor <= 0) {
			throw new SharedExpenseAmountNonPositiveError();
		}
		const id = properties.id.trim();
		const bookId = properties.bookId.trim();
		const description = properties.description.trim();

		const allocations = properties.allocations.map(allocation => this.freezeAllocation(allocation));
		if (
			allocations.length === 0 ||
			new Set(allocations.map(allocation => allocation.participantId)).size !== allocations.length
		) {
			throw new SharedExpenseAllocationsInvalidError();
		}
		const allocatedTotal = allocations.reduce((total, allocation) => total + BigInt(allocation.amountMinor), 0n);
		if (allocatedTotal !== BigInt(properties.amountMinor)) {
			throw new SharedExpenseAllocationTotalMismatchError();
		}

		const settlements = properties.settlements.map(settlement => this.freezeSettlement(settlement));
		const allocationAmounts = new Map(
			allocations.map(allocation => [allocation.participantId, allocation.amountMinor])
		);
		if (
			settlements.length !== allocations.length ||
			new Set(settlements.map(settlement => settlement.participantId)).size !== settlements.length ||
			settlements.some(settlement => allocationAmounts.get(settlement.participantId) !== settlement.amountMinor)
		) {
			throw new SharedExpenseSettlementsInvalidError();
		}

		return new this({
			actor: this.freezeActor(properties.actor),
			allocations: Object.freeze(allocations),
			amountMinor: properties.amountMinor,
			bookId,
			...(properties.closedAt !== undefined && { closedAt: properties.closedAt }),
			createdAt: properties.createdAt,
			description,
			id,
			settlements: Object.freeze(settlements),
		});
	}

	private static freezeActor(actor: SharedExpenseActor): SharedExpenseActor {
		if (!(Object.values(SHARED_EXPENSE_ACTOR_KIND) as string[]).includes(actor.kind)) {
			throw new SharedExpenseActorInvalidError();
		}
		if (actor.kind === SHARED_EXPENSE_ACTOR_KIND.UNKNOWN) {
			return Object.freeze({ kind: SHARED_EXPENSE_ACTOR_KIND.UNKNOWN });
		}

		const id = actor.id.trim();
		if (id.length === 0) {
			throw new SharedExpenseActorIdInvalidError();
		}

		return Object.freeze({ id, kind: actor.kind });
	}

	private static freezeAllocation(allocation: SharedExpenseAllocation): SharedExpenseAllocation {
		const participantId = allocation.participantId.trim();
		const participantName = allocation.participantName.trim();
		if (
			participantId.length === 0 ||
			participantName.length === 0 ||
			participantName.length > 120 ||
			!Number.isSafeInteger(allocation.amountMinor) ||
			allocation.amountMinor < 0
		) {
			throw new SharedExpenseAllocationsInvalidError();
		}

		return Object.freeze({ ...allocation, participantId, participantName });
	}

	private static freezeSettlement(settlement: SharedExpenseSettlement): SharedExpenseSettlement {
		if (!Object.values(SHARED_EXPENSE_SETTLEMENT_STATUS).includes(settlement.status)) {
			throw new SharedExpenseSettlementStatusInvalidError();
		}
		const participantId = settlement.participantId.trim();
		if (participantId.length === 0 || !Number.isSafeInteger(settlement.amountMinor) || settlement.amountMinor < 0) {
			throw new SharedExpenseSettlementsInvalidError();
		}

		const settledByActor =
			settlement.settledByActor === undefined ? undefined : this.freezeActor(settlement.settledByActor);
		const hasSettlementDetails = settlement.settledAt !== undefined || settledByActor !== undefined;
		const hasIncompleteSettlement = settlement.settledAt === undefined || settledByActor === undefined;
		if (
			settlement.status === SHARED_EXPENSE_SETTLEMENT_STATUS.PENDING
				? hasSettlementDetails
				: hasIncompleteSettlement
		) {
			throw new SharedExpenseSettlementsInvalidError();
		}

		return Object.freeze({
			amountMinor: settlement.amountMinor,
			participantId,
			...(settlement.settledAt !== undefined && { settledAt: settlement.settledAt }),
			...(settledByActor !== undefined && { settledByActor }),
			status: settlement.status,
		});
	}

	close(closedAt: string): SharedExpense {
		if (this.closedAt !== undefined) {
			throw new SharedExpenseTransitionInvalidError('closed', 'closed');
		}

		return SharedExpense.restore({ ...this.toProperties(), closedAt });
	}

	reopen(): SharedExpense {
		if (this.closedAt === undefined) {
			throw new SharedExpenseTransitionInvalidError('open', 'open');
		}

		const { closedAt: _closedAt, ...properties } = this.toProperties();

		return SharedExpense.restore(properties);
	}

	settle(participantId: string, actor: SharedExpenseActor, settledAt: string): SharedExpense {
		if (this.closedAt !== undefined) {
			throw new SharedExpenseTransitionInvalidError('closed', 'settled');
		}
		const settlement = this.settlements.find(item => item.participantId === participantId);
		if (settlement?.status !== SHARED_EXPENSE_SETTLEMENT_STATUS.PENDING) {
			throw new SharedExpenseSettlementTransitionInvalidError(participantId);
		}

		return SharedExpense.restore({
			...this.toProperties(),
			settlements: this.settlements.map(item =>
				item.participantId === participantId
					? { ...item, settledAt, settledByActor: actor, status: SHARED_EXPENSE_SETTLEMENT_STATUS.SETTLED }
					: item
			),
		});
	}

	private toProperties(): SharedExpenseProperties {
		return {
			actor: this.actor,
			allocations: this.allocations,
			amountMinor: this.amountMinor,
			bookId: this.bookId,
			...(this.closedAt !== undefined && { closedAt: this.closedAt }),
			createdAt: this.createdAt,
			description: this.description,
			id: this.id,
			settlements: this.settlements,
		};
	}
}

export {
	type BuildSharedExpenseInput,
	SHARED_EXPENSE_ACTOR_KIND,
	SHARED_EXPENSE_SETTLEMENT_STATUS,
	SharedExpense,
	type SharedExpenseActor,
	type SharedExpenseActorKind,
	type SharedExpenseAllocation,
	type SharedExpenseProperties,
	type SharedExpenseSettlement,
	type SharedExpenseSettlementStatus,
};
