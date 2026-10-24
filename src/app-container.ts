import { Container } from '@inferdi/inferdi';
import {
	CloseAccount,
	CreateAccount,
	GetAccountBalances,
	ListAccounts,
	ReopenAccount,
} from '@modules/accounts/application';
import { SqliteAccountRepository } from '@modules/accounts/infrastructure';
import { ArchiveBook, CreateBook, DeleteBook, ListBooks, SqliteBookRepository } from '@modules/books';
import { CreateBudget, GetBudgetReport, ListBudgets } from '@modules/budgets/application';
import { SqliteBudgetActualsQuery, SqliteBudgetRepository } from '@modules/budgets/infrastructure';
import {
	ArchiveClassification,
	CreateClassification,
	DeleteClassification,
	ListClassifications,
	RestoreClassification,
	UpdateClassification,
} from '@modules/classifications/application';
import { SqliteCategoryRepository, SqliteClassRepository } from '@modules/classifications/infrastructure';
import { CommitStatementImport, PreviewStatementImport } from '@modules/imports/application';
import { SqliteStatementImportRepository } from '@modules/imports/infrastructure';
import {
	CreateTransaction,
	CreateTransfer,
	DeleteTransaction,
	ListTransactions,
	SetTransactionStatus,
	UpdateTransaction,
} from '@modules/ledger/application';
import { SqliteLedgerRepository } from '@modules/ledger/infrastructure';
import {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
	UpdateSchedule,
} from '@modules/schedules/application';
import { SqliteScheduleOccurrenceRepository, SqliteScheduleRepository } from '@modules/schedules/infrastructure';
import {
	CloseSharedExpense,
	CreateSharedExpense,
	CreateSharedExpenseParticipant,
	ListSharedExpenseParticipants,
	ListSharedExpenses,
	RemoveSharedExpenseParticipant,
	ReopenSharedExpense,
	SettleSharedExpense,
} from '@modules/shared-expenses/application';
import { SqliteSharedExpenseRepository } from '@modules/shared-expenses/infrastructure';
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

function buildRepositories(database: Database) {
	return new Container()
		.registerValue('database', database)
		.registerClass('accountRepository', SqliteAccountRepository, ['database'])
		.registerClass('bookRepository', SqliteBookRepository, ['database'])
		.registerClass('budgetActuals', SqliteBudgetActualsQuery, ['database'])
		.registerClass('budgetRepository', SqliteBudgetRepository, ['database'])
		.registerClass('categoryRepository', SqliteCategoryRepository, ['database'])
		.registerClass('classRepository', SqliteClassRepository, ['database'])
		.registerClass('importRepository', SqliteStatementImportRepository, ['database'])
		.registerClass('ledgerRepository', SqliteLedgerRepository, ['database'])
		.registerClass('scheduleOccurrenceRepository', SqliteScheduleOccurrenceRepository, ['database'])
		.registerClass('scheduleRepository', SqliteScheduleRepository, ['database'])
		.registerClass('sharedExpenseRepository', SqliteSharedExpenseRepository, ['database'])
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
	return container
		.registerFactory(
			'accountUseCases',
			c => {
				const accounts = c.get('accountRepository');

				return {
					balances: new GetAccountBalances(accounts, accounts, c.get('bookRepository')),
					close: new CloseAccount(accounts),
					create: new CreateAccount(accounts, c.get('bookRepository')),
					list: new ListAccounts(accounts),
					open: new ReopenAccount(accounts),
				};
			},
			['accountRepository', 'bookRepository']
		)
		.registerFactory(
			'bookUseCases',
			c => {
				const books = c.get('bookRepository');

				return {
					archive: new ArchiveBook(books),
					create: new CreateBook(books),
					delete: new DeleteBook(books),
					list: new ListBooks(books),
				};
			},
			['bookRepository']
		)
		.registerFactory(
			'budgetUseCases',
			c => ({
				create: new CreateBudget(
					c.get('budgetRepository'),
					c.get('bookRepository'),
					c.get('accountRepository'),
					c.get('categoryRepository'),
					c.get('classRepository')
				),
				getReport: new GetBudgetReport(c.get('budgetRepository'), c.get('budgetActuals')),
				list: new ListBudgets(c.get('budgetRepository')),
			}),
			[
				'budgetRepository',
				'budgetActuals',
				'bookRepository',
				'accountRepository',
				'categoryRepository',
				'classRepository',
			]
		)
		.registerFactory(
			'classificationUseCases',
			c => {
				const category = c.get('categoryRepository');
				const classRepository = c.get('classRepository');

				return {
					archive: {
						category: new ArchiveClassification(category),
						class: new ArchiveClassification(classRepository),
					},
					create: {
						category: new CreateClassification(category),
						class: new CreateClassification(classRepository),
					},
					delete: {
						category: new DeleteClassification(category),
						class: new DeleteClassification(classRepository),
					},
					list: {
						category: new ListClassifications(category),
						class: new ListClassifications(classRepository),
					},
					restore: {
						category: new RestoreClassification(category),
						class: new RestoreClassification(classRepository),
					},
					update: {
						category: new UpdateClassification(category),
						class: new UpdateClassification(classRepository),
					},
				};
			},
			['categoryRepository', 'classRepository']
		)
		.registerFactory(
			'importUseCases',
			c => ({
				commit: new CommitStatementImport({
					accounts: c.get('accountRepository'),
					books: c.get('bookRepository'),
					imports: c.get('importRepository'),
					ledger: c.get('ledgerRepository'),
				}),
				preview: new PreviewStatementImport({
					accounts: c.get('accountRepository'),
					books: c.get('bookRepository'),
					imports: c.get('importRepository'),
				}),
			}),
			['accountRepository', 'bookRepository', 'importRepository', 'ledgerRepository']
		)
		.registerFactory(
			'ledgerUseCases',
			c => {
				const ledger = c.get('ledgerRepository');

				return {
					create: new CreateTransaction(ledger),
					createTransfer: new CreateTransfer(ledger),
					delete: new DeleteTransaction(ledger),
					list: new ListTransactions(ledger),
					setStatus: new SetTransactionStatus(ledger),
					update: new UpdateTransaction(ledger),
				};
			},
			['ledgerRepository']
		)
		.registerFactory(
			'scheduleUseCases',
			c => {
				const schedules = c.get('scheduleRepository');
				const occurrences = c.get('scheduleOccurrenceRepository');

				return {
					changeStatus: new ChangeScheduleStatus(schedules),
					create: new CreateSchedule(schedules),
					generateOccurrences: new GenerateScheduleOccurrences(schedules, occurrences),
					list: new ListSchedules(schedules),
					listOccurrences: new ListScheduleOccurrences(schedules, occurrences),
					recordOccurrence: new RecordScheduleOccurrence(schedules, occurrences, c.get('ledgerRepository')),
					update: new UpdateSchedule(schedules),
				};
			},
			['scheduleRepository', 'scheduleOccurrenceRepository', 'ledgerRepository']
		)
		.registerFactory(
			'sharedExpenseUseCases',
			c => {
				const sharedExpenses = c.get('sharedExpenseRepository');
				const books = c.get('bookRepository');

				return {
					close: new CloseSharedExpense(sharedExpenses),
					create: new CreateSharedExpense(sharedExpenses, books),
					createParticipant: new CreateSharedExpenseParticipant(sharedExpenses, books),
					list: new ListSharedExpenses(sharedExpenses),
					listParticipants: new ListSharedExpenseParticipants(sharedExpenses),
					removeParticipant: new RemoveSharedExpenseParticipant(sharedExpenses),
					reopen: new ReopenSharedExpense(sharedExpenses),
					settle: new SettleSharedExpense(sharedExpenses),
				};
			},
			['sharedExpenseRepository', 'bookRepository']
		);
}

function buildAppContainer(database: Database) {
	return buildLedgerUseCases(buildCredentialUseCases(buildRepositories(database))).registerFactory(
		'financeUseCases',
		c => ({
			accounts: c.get('accountUseCases'),
			books: c.get('bookUseCases'),
			budgets: c.get('budgetUseCases'),
			classifications: c.get('classificationUseCases'),
			imports: c.get('importUseCases'),
			ledger: c.get('ledgerUseCases'),
			schedules: c.get('scheduleUseCases'),
			sharedExpenses: c.get('sharedExpenseUseCases'),
		}),
		[
			'accountUseCases',
			'bookUseCases',
			'budgetUseCases',
			'classificationUseCases',
			'importUseCases',
			'ledgerUseCases',
			'scheduleUseCases',
			'sharedExpenseUseCases',
		]
	);
}

type AppContainer = ReturnType<typeof buildAppContainer>;

function createAppContainer(database: Database): AppContainer {
	return buildAppContainer(database);
}

export type { AppContainer };
export { createAppContainer };
