import { Currency } from '@modules/money/domain';

import { BookAlreadyArchivedError, BookIdInvalidError, BookNameInvalidError } from './book.error';

const NOT_ARCHIVED = JSON.parse('null') as null;

interface BookInput {
	archivedAt?: null | string;
	createdAt?: string;
	currencyCode: string;
	id: string;
	isDefault?: boolean;
	name: string;
}

interface PersistedBookInput extends BookInput {
	archivedAt: null | string;
	createdAt: string;
	isDefault: boolean;
}

class Book {
	private constructor(
		readonly archivedAt: null | string,
		readonly createdAt: string,
		readonly currencyCode: string,
		readonly id: string,
		readonly isDefault: boolean,
		readonly name: string
	) {}

	static create(input: BookInput): Book {
		const name = input.name.trim();
		if (name.length === 0 || name.length > 80) {
			throw new BookNameInvalidError();
		}

		if (input.id.trim().length === 0) {
			throw new BookIdInvalidError();
		}

		return new this(
			input.archivedAt ?? NOT_ARCHIVED,
			input.createdAt ?? new Date().toISOString(),
			Currency.create(input.currencyCode).code,
			input.id,
			input.isDefault ?? false,
			name
		);
	}

	static restore(input: PersistedBookInput): Book {
		return this.create(input);
	}

	archive(archivedAt: string): Book {
		if (this.archivedAt !== NOT_ARCHIVED) {
			throw new BookAlreadyArchivedError(this.id);
		}

		return Book.create({
			archivedAt,
			createdAt: this.createdAt,
			currencyCode: this.currencyCode,
			id: this.id,
			isDefault: this.isDefault,
			name: this.name,
		});
	}
}

export { Book, type BookInput, type PersistedBookInput };
