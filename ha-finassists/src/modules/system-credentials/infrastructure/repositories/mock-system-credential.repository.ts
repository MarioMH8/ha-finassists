import type { SystemCredential, SystemCredentialRepository } from '@modules/system-credentials/domain';
import { expect, mock } from 'bun:test';

export class MockSystemCredentialRepository implements SystemCredentialRepository {
	private readonly authenticateMock = mock<SystemCredentialRepository['authenticate']>(() =>
		Promise.resolve(undefined)
	);

	private readonly configureBootstrapCapabilityMock = mock<
		SystemCredentialRepository['configureBootstrapCapability']
	>(() => true);

	private readonly exchangeBootstrapCapabilityMock = mock<SystemCredentialRepository['exchangeBootstrapCapability']>(
		() => Promise.resolve(false)
	);

	private readonly revokeMock = mock<SystemCredentialRepository['revoke']>(() => Promise.resolve(false));
	private readonly rotateMock = mock<SystemCredentialRepository['rotate']>(() => Promise.resolve(false));

	assertAuthenticateHasBeenCalledWith(secretHash: string): void {
		expect(this.authenticateMock).toHaveBeenCalledWith(secretHash);
	}

	assertConfigureBootstrapCapabilityHasBeenCalledWith(secretHash: string, expiresAt: string): void {
		expect(this.configureBootstrapCapabilityMock).toHaveBeenCalledWith(secretHash, expiresAt);
	}

	assertExchangeBootstrapCapabilityHasBeenCalledWith(
		capabilityHash: string,
		credential: SystemCredential,
		now: string
	): void {
		expect(this.exchangeBootstrapCapabilityMock).toHaveBeenCalledWith(capabilityHash, credential, now);
	}

	assertRevokeHasBeenCalledWith(secretHash: string): void {
		expect(this.revokeMock).toHaveBeenCalledWith(secretHash);
	}

	assertRotateHasBeenCalledWith(currentSecretHash: string, credential: SystemCredential): void {
		expect(this.rotateMock).toHaveBeenCalledWith(currentSecretHash, credential);
	}

	async authenticate(secretHash: string): Promise<SystemCredential | undefined> {
		return this.authenticateMock(secretHash);
	}

	configureBootstrapCapability(secretHash: string, expiresAt: string): boolean {
		return this.configureBootstrapCapabilityMock(secretHash, expiresAt);
	}

	async exchangeBootstrapCapability(
		capabilityHash: string,
		credential: SystemCredential,
		now: string
	): Promise<boolean> {
		return this.exchangeBootstrapCapabilityMock(capabilityHash, credential, now);
	}

	async revoke(secretHash: string): Promise<boolean> {
		return this.revokeMock(secretHash);
	}

	async rotate(currentSecretHash: string, credential: SystemCredential): Promise<boolean> {
		return this.rotateMock(currentSecretHash, credential);
	}

	shouldAuthenticate(credential: SystemCredential | undefined): void {
		this.authenticateMock.mockResolvedValue(credential);
	}

	shouldConfigureBootstrapCapability(isConfigured: boolean): void {
		this.configureBootstrapCapabilityMock.mockReturnValue(isConfigured);
	}

	shouldExchangeBootstrapCapability(isExchanged: boolean): void {
		this.exchangeBootstrapCapabilityMock.mockResolvedValue(isExchanged);
	}

	shouldRevoke(isRevoked: boolean): void {
		this.revokeMock.mockResolvedValue(isRevoked);
	}

	shouldRotate(isRotated: boolean): void {
		this.rotateMock.mockResolvedValue(isRotated);
	}
}
