import { Container } from '@inferdi/inferdi';
import {
	CreateCategory,
	CreateTransaction,
	DeleteCategory,
	DeleteTransaction,
	DeleteTransactions,
	ListCategories,
	ListTransactions,
	UpdateCategory,
	UpdateTransaction,
} from '@modules/ledger/application';
import { SqliteCategoryRepository, SqliteLedgerRepository } from '@modules/ledger/infrastructure';
import {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import {
	SqliteSystemCredentialRepository,
	WebCryptoSystemCredentialService,
} from '@modules/system-credentials/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import type { Database } from 'bun:sqlite';

interface AppContainerOptions {
	currencyCode: string;
}

function buildRepositories(database: Database, { currencyCode }: AppContainerOptions) {
	return new Container()
		.registerValue('currencyCode', currencyCode)
		.registerValue('database', database)
		.registerClass('categoryRepository', SqliteCategoryRepository, ['database'])
		.registerClass('ledgerRepository', SqliteLedgerRepository, ['database'])
		.registerClass('systemCredentialRepository', SqliteSystemCredentialRepository, ['database'])
		.registerClass('systemCredentialService', WebCryptoSystemCredentialService, [])
		.registerClass('tokenCredentialService', WebCryptoTokenCredentialService, [])
		.registerClass('tokenRepository', SqliteApiTokenRepository, ['database']);
}

function buildCredentialUseCases(container: ReturnType<typeof buildRepositories>) {
	return container
		.registerFactory(
			'tokenUseCases',
			c => ({
				authenticate: new AuthenticateApiToken(c.get('tokenRepository'), c.get('tokenCredentialService')),
				issue: new IssueApiToken(c.get('tokenRepository'), c.get('tokenCredentialService')),
				list: new ListApiTokens(c.get('tokenRepository')),
				revoke: new RevokeApiToken(c.get('tokenRepository')),
			}),
			['tokenRepository', 'tokenCredentialService']
		)
		.registerFactory(
			'systemCredentialUseCases',
			c => {
				const repository = c.get('systemCredentialRepository');
				const service = c.get('systemCredentialService');

				return {
					authenticate: new AuthenticateSystemCredential(repository, service),
					exchange: new ExchangeSystemCredential(repository, service),
					revoke: new RevokeSystemCredential(repository, service),
					rotate: new RotateSystemCredential(repository, service),
				};
			},
			['systemCredentialRepository', 'systemCredentialService']
		);
}

function buildLedgerUseCases(container: ReturnType<typeof buildCredentialUseCases>) {
	return container.registerFactory(
		'ledgerUseCases',
		c => ({
			categories: {
				create: new CreateCategory(c.get('categoryRepository')),
				delete: new DeleteCategory(c.get('categoryRepository')),
				list: new ListCategories(c.get('categoryRepository')),
				update: new UpdateCategory(c.get('categoryRepository')),
			},
			create: new CreateTransaction(
				c.get('ledgerRepository'),
				c.get('categoryRepository'),
				c.get('currencyCode')
			),
			delete: new DeleteTransaction(c.get('ledgerRepository')),
			deleteMany: new DeleteTransactions(c.get('ledgerRepository')),
			list: new ListTransactions(c.get('ledgerRepository')),
			update: new UpdateTransaction(c.get('ledgerRepository'), c.get('categoryRepository')),
		}),
		['categoryRepository', 'ledgerRepository', 'currencyCode']
	);
}

function buildAppContainer(database: Database, options: AppContainerOptions) {
	return buildLedgerUseCases(buildCredentialUseCases(buildRepositories(database, options))).registerFactory(
		'financeUseCases',
		c => ({ ledger: c.get('ledgerUseCases') }),
		['ledgerUseCases']
	);
}

type AppContainer = ReturnType<typeof buildAppContainer>;

function createAppContainer(database: Database, options: AppContainerOptions): AppContainer {
	return buildAppContainer(database, options);
}

export type { AppContainer, AppContainerOptions };
export { createAppContainer };
