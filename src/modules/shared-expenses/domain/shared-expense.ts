import type { IngressActor } from '@modules/home-assistant/domain';

import type { SharedExpenseParticipant } from './participant';

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
	id: string;
	kind: typeof SHARED_EXPENSE_ACTOR_KIND.HOME_ASSISTANT_USER;
}

interface HomeAssistantIntegrationSharedExpenseActor {
	id: string;
	kind: typeof SHARED_EXPENSE_ACTOR_KIND.HOME_ASSISTANT_INTEGRATION;
}

interface UnknownSharedExpenseActor {
	kind: typeof SHARED_EXPENSE_ACTOR_KIND.UNKNOWN;
}

type SharedExpenseActor =
	HomeAssistantIntegrationSharedExpenseActor | HomeAssistantSharedExpenseActor | UnknownSharedExpenseActor;

interface SharedExpenseAllocation {
	amountMinor: number;
	participantId: string;
	participantName: string;
}

interface SharedExpenseSettlement {
	amountMinor: number;
	participantId: string;
	settledAt?: string;
	settledByActor?: SharedExpenseActor;
	status: SharedExpenseSettlementStatus;
}

interface SharedExpense {
	actor: SharedExpenseActor;
	allocations: SharedExpenseAllocation[];
	amountMinor: number;
	bookId: string;
	closedAt?: string;
	createdAt: string;
	description: string;
	id: string;
	settlements: SharedExpenseSettlement[];
}

interface BuildSharedExpenseInput {
	actor: IngressActor;
	amountMinor: number;
	bookId: string;
	createdAt?: string;
	description: string;
	id: string;
	participants: SharedExpenseParticipant[];
}

function toSharedExpenseActor(actor: IngressActor): SharedExpenseActor {
	if (actor.kind === 'unknown') {
		return { kind: SHARED_EXPENSE_ACTOR_KIND.UNKNOWN };
	}

	const id = actor.id.trim();
	if (id.length === 0) {
		throw new Error('Expense actor id must not be empty');
	}

	return { id, kind: actor.kind };
}

function createSharedExpense(input: BuildSharedExpenseInput): SharedExpense {
	const id = input.id.trim();
	if (id.length === 0) {
		throw new Error('Shared expense id must not be empty');
	}

	const bookId = input.bookId.trim();
	if (bookId.length === 0) {
		throw new Error('Shared expense book id must not be empty');
	}

	const description = input.description.trim();
	if (description.length === 0 || description.length > 200) {
		throw new Error('Shared expense description must contain between 1 and 200 characters');
	}
	if (!Number.isSafeInteger(input.amountMinor)) {
		throw new TypeError('Expense minor units must be a safe integer');
	}
	if (input.amountMinor <= 0) {
		throw new Error('Expense amount must be greater than zero');
	}
	if (input.participants.length === 0) {
		throw new Error('Shared expense must have at least one participant');
	}

	if (new Set(input.participants.map(participant => participant.id)).size !== input.participants.length) {
		throw new Error('Shared expense participants must be unique');
	}

	for (const participant of input.participants) {
		if (participant.bookId !== bookId) {
			throw new Error('Shared expense participants must belong to the same book');
		}
		if (participant.removedAt !== undefined) {
			throw new Error(`Participant ${participant.id} is no longer active`);
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
	const allocatedTotal = allocations.reduce((total, allocation) => total + BigInt(allocation.amountMinor), 0n);
	if (allocatedTotal !== amount) {
		throw new Error('Shared expense allocations must sum to the expense amount');
	}

	return {
		actor: toSharedExpenseActor(input.actor),
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
	};
}

export {
	type BuildSharedExpenseInput,
	createSharedExpense,
	SHARED_EXPENSE_ACTOR_KIND,
	SHARED_EXPENSE_SETTLEMENT_STATUS,
	type SharedExpense,
	type SharedExpenseActor,
	type SharedExpenseActorKind,
	type SharedExpenseAllocation,
	type SharedExpenseSettlement,
	type SharedExpenseSettlementStatus,
	toSharedExpenseActor,
};
