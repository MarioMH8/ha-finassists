import { expect, mock } from 'bun:test';

import type { SystemCredentialSecret, SystemCredentialService } from '../../domain';

export class MockSystemCredentialService implements SystemCredentialService {
	private readonly createMock = mock<SystemCredentialService['create']>();
	private readonly hashMock = mock<SystemCredentialService['hash']>();

	assertHashHasBeenCalledWith(secret: string): void {
		expect(this.hashMock).toHaveBeenCalledWith(secret);
	}

	async create(): Promise<SystemCredentialSecret> {
		return this.createMock();
	}

	async hash(secret: string): Promise<string> {
		return this.hashMock(secret);
	}

	shouldCreate(credential: SystemCredentialSecret): void {
		this.createMock.mockResolvedValue(credential);
	}

	shouldHash(secret: string, hash: string): void {
		this.hashMock.mockImplementation(value => Promise.resolve(value === secret ? hash : ''));
	}
}
