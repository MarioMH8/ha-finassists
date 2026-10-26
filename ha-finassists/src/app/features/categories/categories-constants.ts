const CATEGORY_NAME_MAX_LENGTH = 40;

const CATEGORY_FILTER = {
	ALL: 'all',
	EXPENSE: 'expense',
	INCOME: 'income',
} as const;

type CategoryFilter = (typeof CATEGORY_FILTER)[keyof typeof CATEGORY_FILTER];

const LOAD_STATE = {
	ERROR: 'error',
	LOADING: 'loading',
	READY: 'ready',
} as const;

type LoadState = (typeof LOAD_STATE)[keyof typeof LOAD_STATE];

interface CategoryFormErrors {
	name?: 'required' | 'tooLong';
}

export {
	CATEGORY_FILTER,
	CATEGORY_NAME_MAX_LENGTH,
	type CategoryFilter,
	type CategoryFormErrors,
	LOAD_STATE,
	type LoadState,
};
