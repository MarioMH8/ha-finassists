import { expect, mock } from 'bun:test';

import type { TokenCredential, TokenCredentialService } from '../../domain';

export class MockTokenCredentialService implements TokenCredentialService {
	private readonly createMock = mock<TokenCredentialService['create']>();
	private readonly hashMock = mock<TokenCredentialService['hash']>();

	assertHashHasBeenCalledWith(secret: string): void {
		expect(this.hashMock).toHaveBeenCalledWith(secret);
	}

	async create(): Promise<TokenCredential> {
		return this.createMock();
	}

	async hash(secret: string): Promise<string> {
		return this.hashMock(secret);
	}

	shouldCreate(credential: TokenCredential): void {
		this.createMock.mockResolvedValue(credential);
	}

	shouldHash(secret: string, hash: string): void {
		this.hashMock.mockImplementation(value => Promise.resolve(value === secret ? hash : ''));
	}
}
