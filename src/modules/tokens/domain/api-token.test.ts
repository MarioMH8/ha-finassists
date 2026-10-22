import { describe, expect, it } from 'bun:test';

import { ApiTokenMother } from './api-token.mother';
import { TokenNameRequiredError } from './token-name-required.error';

describe('ApiToken', () => {
	describe('create', () => {
		it('trims the name used to identify the token', () => {
			const token = ApiTokenMother.create({ name: '  Home Assistant  ' });

			expect(token.name).toBe('Home Assistant');
		});

		it('rejects an empty name', () => {
			expect(() => ApiTokenMother.create({ name: '  ' })).toThrow(TokenNameRequiredError);
		});
	});
});
