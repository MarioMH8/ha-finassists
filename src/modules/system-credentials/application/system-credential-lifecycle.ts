import type {
	SystemCredential,
	SystemCredentialRepository,
	SystemCredentialService,
} from '@modules/system-credentials/domain';

const SYSTEM_CREDENTIAL_ID = 'home-assistant-integration';

interface IssuedSystemCredential {
	credential: string;
	id: string;
}

class ExchangeSystemCredential {
	constructor(
		private readonly repository: SystemCredentialRepository,
		private readonly credentials: SystemCredentialService,
		private readonly now: () => Date = () => new Date()
	) {}

	async execute(capability: string): Promise<IssuedSystemCredential | undefined> {
		const secret = await this.credentials.create();
		const now = this.now().toISOString();
		const credential: SystemCredential = {
			createdAt: now,
			id: SYSTEM_CREDENTIAL_ID,
			prefix: secret.prefix,
			secretHash: secret.hash,
		};
		const isRedeemed = await this.repository.exchangeBootstrapCapability(
			await this.credentials.hash(capability),
			credential,
			now
		);

		return isRedeemed ? { credential: secret.secret, id: credential.id } : undefined;
	}
}

class AuthenticateSystemCredential {
	constructor(
		private readonly repository: SystemCredentialRepository,
		private readonly credentials: SystemCredentialService
	) {}

	async execute(secret: string): Promise<SystemCredential | undefined> {
		return this.repository.authenticate(await this.credentials.hash(secret));
	}
}

class RotateSystemCredential {
	constructor(
		private readonly repository: SystemCredentialRepository,
		private readonly credentials: SystemCredentialService,
		private readonly now: () => Date = () => new Date()
	) {}

	async execute(currentSecret: string): Promise<IssuedSystemCredential | undefined> {
		const secret = await this.credentials.create();
		const credential: SystemCredential = {
			createdAt: this.now().toISOString(),
			id: SYSTEM_CREDENTIAL_ID,
			prefix: secret.prefix,
			secretHash: secret.hash,
		};
		const isRotated = await this.repository.rotate(await this.credentials.hash(currentSecret), credential);

		return isRotated ? { credential: secret.secret, id: credential.id } : undefined;
	}
}

class RevokeSystemCredential {
	constructor(
		private readonly repository: SystemCredentialRepository,
		private readonly credentials: SystemCredentialService
	) {}

	async execute(currentSecret: string): Promise<boolean> {
		return this.repository.revoke(await this.credentials.hash(currentSecret));
	}
}

export {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	type IssuedSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
	SYSTEM_CREDENTIAL_ID,
};
