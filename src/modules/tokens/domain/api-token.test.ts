import { describe, expect, it } from 'bun:test';

import { TokenNameRequiredError } from './api-token.error';
import { ApiTokenMother } from './api-token.mother';

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
