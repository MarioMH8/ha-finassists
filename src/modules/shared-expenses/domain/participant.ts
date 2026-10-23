import {
	SharedExpenseParticipantBookIdInvalidError,
	SharedExpenseParticipantIdInvalidError,
	SharedExpenseParticipantNameInvalidError,
} from './participant.error';

interface SharedExpenseParticipantInput {
	bookId: string;
	createdAt?: string;
	id: string;
	name: string;
	removedAt?: string;
}

interface PersistedSharedExpenseParticipantInput extends SharedExpenseParticipantInput {
	createdAt: string;
}

class SharedExpenseParticipant {
	readonly bookId: string;
	readonly createdAt: string;
	readonly id: string;
	readonly name: string;
	declare readonly removedAt?: string;

	private constructor(properties: PersistedSharedExpenseParticipantInput) {
		this.bookId = properties.bookId;
		this.createdAt = properties.createdAt;
		this.id = properties.id;
		this.name = properties.name;
		if (properties.removedAt !== undefined) {
			this.removedAt = properties.removedAt;
		}
	}

	static create(input: SharedExpenseParticipantInput): SharedExpenseParticipant {
		return this.restore({
			...input,
			createdAt: input.createdAt ?? new Date().toISOString(),
		});
	}

	static restore(input: PersistedSharedExpenseParticipantInput): SharedExpenseParticipant {
		if (input.id.trim().length === 0) {
			throw new SharedExpenseParticipantIdInvalidError();
		}
		if (input.bookId.trim().length === 0) {
			throw new SharedExpenseParticipantBookIdInvalidError();
		}
		if (input.name.trim().length === 0 || input.name.trim().length > 120) {
			throw new SharedExpenseParticipantNameInvalidError();
		}

		const id = input.id.trim();
		const bookId = input.bookId.trim();
		const name = input.name.trim();

		return new this({ ...input, bookId, id, name });
	}
}

export { type PersistedSharedExpenseParticipantInput, SharedExpenseParticipant, type SharedExpenseParticipantInput };
