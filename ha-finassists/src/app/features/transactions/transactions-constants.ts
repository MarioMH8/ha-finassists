const FILTER_KIND = {
	ALL: 'all',
	EXPENSE: 'expense',
	INCOME: 'income',
} as const;

type FilterKind = (typeof FILTER_KIND)[keyof typeof FILTER_KIND];

const LOAD_STATE = {
	ERROR: 'error',
	LOADING: 'loading',
	READY: 'ready',
} as const;

type LoadState = (typeof LOAD_STATE)[keyof typeof LOAD_STATE];

const PAGE_SIZES = [10, 20, 50, 100] as const;

const DEFAULT_PAGE_SIZE = 20;

type PageSize = (typeof PAGE_SIZES)[number];

interface TransactionFilters {
	fromDate: string;
	kind: FilterKind;
	search: string;
	toDate: string;
}

export {
	DEFAULT_PAGE_SIZE,
	FILTER_KIND,
	type FilterKind,
	LOAD_STATE,
	type LoadState,
	PAGE_SIZES,
	type PageSize,
	type TransactionFilters,
};
