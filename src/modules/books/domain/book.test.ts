import { describe, expect, it } from 'bun:test';

import { BookAlreadyArchivedError, BookIdInvalidError, BookNameInvalidError } from './book.error';
import { BookMother } from './book.mother';

const NOT_ARCHIVED = JSON.parse('null') as null;

describe('Book', () => {
	it('should create a normalized book with default state', () => {
		const book = BookMother.create({ currencyCode: ' eur ', name: ' Household ' });

		expect(book).toMatchObject({
			archivedAt: NOT_ARCHIVED,
			currencyCode: 'EUR',
			id: 'book-1',
			isDefault: false,
			name: 'Household',
		});
		expect(Number.isNaN(Date.parse(book.createdAt))).toBe(false);
	});

	it('should throw BookNameInvalidError when the name is outside its valid range', () => {
		expect(() => BookMother.create({ name: ' ' })).toThrow(BookNameInvalidError);
		expect(() => BookMother.create({ name: 'x'.repeat(81) })).toThrow(BookNameInvalidError);
	});

	it('should throw BookIdInvalidError when the id is empty', () => {
		expect(() => BookMother.create({ id: ' ' })).toThrow(BookIdInvalidError);
	});

	it('should archive immutably and reject archiving an archived book', () => {
		const book = BookMother.create();
		const archived = book.archive('2026-05-18T12:00:00.000Z');

		expect(book.archivedAt).toBeNull();
		expect(archived.archivedAt).toBe('2026-05-18T12:00:00.000Z');
		expect(() => archived.archive('2026-05-18T12:01:00.000Z')).toThrow(BookAlreadyArchivedError);
	});
});
