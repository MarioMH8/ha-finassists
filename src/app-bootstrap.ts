import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
	CloseAccount,
	CreateAccount,
	GetAccountBalances,
	ListAccounts,
	ReopenAccount,
} from '@modules/accounts/application';
import { SqliteAccountRepository } from '@modules/accounts/infrastructure';
import { createServer, prepareWebAssets } from '@modules/api';
import {
	ArchiveBook,
	CreateBook,
	DeleteBook,
	EnsureDefaultBook,
	ListBooks,
	SqliteBookRepository,
} from '@modules/books';
import { CreateBudget, GetBudgetReport, ListBudgets } from '@modules/budgets/application';
import {
	initializeBudgetSchema,
	SqliteBudgetActualsQuery,
	SqliteBudgetRepository,
} from '@modules/budgets/infrastructure';
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
import {
	initializeScheduleSchema,
	SqliteScheduleOccurrenceRepository,
	SqliteScheduleRepository,
} from '@modules/schedules/infrastructure';
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
import { initializeSharedExpenseSchema, SqliteSharedExpenseRepository } from '@modules/shared-expenses/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import {
	createBootstrapCapability,
	publishSupervisorDiscovery,
	SqliteSystemCredentialRepository,
	WebCryptoSystemCredentialService,
} from '@modules/system-credentials/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';

import { loadServerConfig } from './config';

async function startApp(): Promise<ReturnType<typeof createServer>> {
	const config = await loadServerConfig();
	await prepareWebAssets(config.developmentMode);
	await mkdir(path.dirname(config.databasePath), { recursive: true });
	const database = new Database(config.databasePath);
	database.run('PRAGMA journal_mode = WAL');
	migrateDatabase(database);
	initializeBudgetSchema(database);
	initializeScheduleSchema(database);
	initializeSharedExpenseSchema(database);
	const bookRepository = new SqliteBookRepository(database);
	new EnsureDefaultBook(bookRepository).execute();
	const accountRepository = new SqliteAccountRepository(database);
	const categoryRepository = new SqliteCategoryRepository(database);
	const classRepository = new SqliteClassRepository(database);
	const ledgerRepository = new SqliteLedgerRepository(database);
	const importRepository = new SqliteStatementImportRepository(database);
	const budgetRepository = new SqliteBudgetRepository(database);
	const budgetActuals = new SqliteBudgetActualsQuery(database);
	const scheduleRepository = new SqliteScheduleRepository(database);
	const scheduleOccurrenceRepository = new SqliteScheduleOccurrenceRepository(database);
	const sharedExpenseRepository = new SqliteSharedExpenseRepository(database);
	const tokenRepository = new SqliteApiTokenRepository(database);
	const tokenCredentialService = new WebCryptoTokenCredentialService();
	const tokenUseCases = {
		authenticate: new AuthenticateApiToken(tokenRepository, tokenCredentialService),
		issue: new IssueApiToken(tokenRepository, tokenCredentialService),
		list: new ListApiTokens(tokenRepository),
		revoke: new RevokeApiToken(tokenRepository),
	};
	const systemCredentialRepository = new SqliteSystemCredentialRepository(database);
	const systemCredentialService = new WebCryptoSystemCredentialService();
	const bootstrapCapability =
		config.supervisorToken === undefined ? config.bootstrapCapability : createBootstrapCapability();
	const isBootstrapCapabilityConfigured =
		bootstrapCapability !== undefined &&
		systemCredentialRepository.configureBootstrapCapability(
			await systemCredentialService.hash(bootstrapCapability),
			new Date(Date.now() + 15 * 60 * 1000).toISOString()
		);
	const systemCredentialUseCases = {
		authenticate: new AuthenticateSystemCredential(systemCredentialRepository, systemCredentialService),
		exchange: new ExchangeSystemCredential(systemCredentialRepository, systemCredentialService),
		revoke: new RevokeSystemCredential(systemCredentialRepository, systemCredentialService),
		rotate: new RotateSystemCredential(systemCredentialRepository, systemCredentialService),
	};
	const financeUseCases = {
		accounts: {
			balances: new GetAccountBalances(accountRepository, accountRepository, bookRepository),
			close: new CloseAccount(accountRepository),
			create: new CreateAccount(accountRepository, bookRepository),
			list: new ListAccounts(accountRepository),
			open: new ReopenAccount(accountRepository),
		},
		books: {
			archive: new ArchiveBook(bookRepository),
			create: new CreateBook(bookRepository),
			delete: new DeleteBook(bookRepository),
			list: new ListBooks(bookRepository),
		},
		budgets: {
			create: new CreateBudget(
				budgetRepository,
				bookRepository,
				accountRepository,
				categoryRepository,
				classRepository
			),
			getReport: new GetBudgetReport(budgetRepository, budgetActuals),
			list: new ListBudgets(budgetRepository),
		},
		classifications: {
			archive: {
				category: new ArchiveClassification(categoryRepository),
				class: new ArchiveClassification(classRepository),
			},
			create: {
				category: new CreateClassification(categoryRepository),
				class: new CreateClassification(classRepository),
			},
			delete: {
				category: new DeleteClassification(categoryRepository),
				class: new DeleteClassification(classRepository),
			},
			list: {
				category: new ListClassifications(categoryRepository),
				class: new ListClassifications(classRepository),
			},
			restore: {
				category: new RestoreClassification(categoryRepository),
				class: new RestoreClassification(classRepository),
			},
			update: {
				category: new UpdateClassification(categoryRepository),
				class: new UpdateClassification(classRepository),
			},
		},
		imports: {
			commit: new CommitStatementImport({
				accounts: accountRepository,
				books: bookRepository,
				imports: importRepository,
				ledger: ledgerRepository,
			}),
			preview: new PreviewStatementImport({
				accounts: accountRepository,
				books: bookRepository,
				imports: importRepository,
			}),
		},
		ledger: {
			create: new CreateTransaction(ledgerRepository),
			createTransfer: new CreateTransfer(ledgerRepository),
			delete: new DeleteTransaction(ledgerRepository),
			list: new ListTransactions(ledgerRepository),
			setStatus: new SetTransactionStatus(ledgerRepository),
			update: new UpdateTransaction(ledgerRepository),
		},
		schedules: {
			changeStatus: new ChangeScheduleStatus(scheduleRepository),
			create: new CreateSchedule(scheduleRepository),
			generateOccurrences: new GenerateScheduleOccurrences(scheduleRepository, scheduleOccurrenceRepository),
			list: new ListSchedules(scheduleRepository),
			listOccurrences: new ListScheduleOccurrences(scheduleRepository, scheduleOccurrenceRepository),
			recordOccurrence: new RecordScheduleOccurrence(
				scheduleRepository,
				scheduleOccurrenceRepository,
				ledgerRepository
			),
			update: new UpdateSchedule(scheduleRepository),
		},
		sharedExpenses: {
			close: new CloseSharedExpense(sharedExpenseRepository),
			create: new CreateSharedExpense(sharedExpenseRepository, bookRepository),
			createParticipant: new CreateSharedExpenseParticipant(sharedExpenseRepository, bookRepository),
			list: new ListSharedExpenses(sharedExpenseRepository),
			listParticipants: new ListSharedExpenseParticipants(sharedExpenseRepository),
			removeParticipant: new RemoveSharedExpenseParticipant(sharedExpenseRepository),
			reopen: new ReopenSharedExpense(sharedExpenseRepository),
			settle: new SettleSharedExpense(sharedExpenseRepository),
		},
	};

	const server = createServer({
		developmentActor: config.developmentActor,
		developmentMode: config.developmentMode,
		financeUseCases,
		port: config.port,
		shellConfig: config.shellConfig,
		systemCredentialUseCases,
		tokenUseCases,
		trustedIngressIp: config.trustedIngressIp,
	});

	if (isBootstrapCapabilityConfigured && config.supervisorToken !== undefined) {
		try {
			await publishSupervisorDiscovery(config.supervisorToken, bootstrapCapability);
		} catch {
			await server.stop(true);
			database.close();
			throw new Error('Unable to provision Home Assistant integration discovery; add-on startup aborted');
		}
	}

	return server;
}

export { startApp as startApplication };
