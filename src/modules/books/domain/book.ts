import { Currency } from '@modules/money/domain';

const JSON_NULL = JSON.parse('null') as null;

interface BookInput {
	archivedAt?: null | string;
	createdAt?: string;
	currencyCode: string;
	id: string;
	isDefault?: boolean;
	name: string;
}

interface Book {
	archivedAt: null | string;
	createdAt: string;
	currencyCode: string;
	id: string;
	isDefault: boolean;
	name: string;
}

function createBook(input: BookInput): Book {
	const name = input.name.trim();
	if (name.length === 0 || name.length > 80) {
		throw new Error('Book name must contain between 1 and 80 characters');
	}

	if (input.id.trim().length === 0) {
		throw new Error('Book id must not be empty');
	}

	return {
		archivedAt: input.archivedAt ?? JSON_NULL,
		createdAt: input.createdAt ?? new Date().toISOString(),
		currencyCode: Currency.create(input.currencyCode).code,
		id: input.id,
		isDefault: input.isDefault ?? false,
		name,
	};
}

export { type Book, type BookInput, createBook };
