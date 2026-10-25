interface TokenCredential {
	hash: string;
	prefix: string;
	secret: string;
}

interface TokenCredentialService {
	create(): Promise<TokenCredential>;
	hash(secret: string): Promise<string>;
}

export type { TokenCredential, TokenCredentialService };
