import type {
	CreateCategory,
	CreateScheduledTransaction,
	CreateTransaction,
	DeleteCategory,
	DeleteScheduledTransaction,
	DeleteTransaction,
	DeleteTransactions,
	ListCategories,
	ListScheduledTransactions,
	ListTransactions,
	ListUpcomingScheduledTransactions,
	PostScheduledTransaction,
	SkipScheduledTransaction,
	UpdateCategory,
	UpdateScheduledTransaction,
	UpdateTransaction,
} from '@modules/ledger/application';
import type { FeatureFlags } from '@modules/shell/domain';

interface FinanceUseCases {
	ledger: {
		categories: {
			create: CreateCategory;
			delete: DeleteCategory;
			list: ListCategories;
			update: UpdateCategory;
		};
		create: CreateTransaction;
		delete: DeleteTransaction;
		deleteMany: DeleteTransactions;
		list: ListTransactions;
		scheduled: {
			create: CreateScheduledTransaction;
			delete: DeleteScheduledTransaction;
			list: ListScheduledTransactions;
			post: PostScheduledTransaction;
			skip: SkipScheduledTransaction;
			upcoming: ListUpcomingScheduledTransactions;
			update: UpdateScheduledTransaction;
		};
		update: UpdateTransaction;
	};
	today: () => string;
}

interface RouteActor {
	id: string;
	kind?: 'home_assistant_integration' | 'home_assistant_user';
}

interface FinanceEnvironment {
	Variables: { actor: RouteActor; features: FeatureFlags; useCases: FinanceUseCases };
}

export type { FinanceEnvironment, FinanceUseCases, RouteActor };
