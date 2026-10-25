interface SystemCredential {
	createdAt: string;
	id: string;
	prefix: string;
	secretHash: string;
}

interface SystemCredentialSecret {
	hash: string;
	prefix: string;
	secret: string;
}

interface SystemCredentialService {
	create(): Promise<SystemCredentialSecret>;
	hash(secret: string): Promise<string>;
}

interface SystemCredentialRepository {
	authenticate(secretHash: string): Promise<SystemCredential | undefined>;
	configureBootstrapCapability(secretHash: string, expiresAt: string): boolean;
	exchangeBootstrapCapability(capabilityHash: string, credential: SystemCredential, now: string): Promise<boolean>;
	revoke(secretHash: string): Promise<boolean>;
	rotate(currentSecretHash: string, credential: SystemCredential): Promise<boolean>;
}

export type { SystemCredential, SystemCredentialRepository, SystemCredentialSecret, SystemCredentialService };
