const CATEGORY_KIND = {
	EXPENSE: 'expense',
	INCOME: 'income',
} as const;

type CategoryKind = (typeof CATEGORY_KIND)[keyof typeof CATEGORY_KIND];

interface CategoryDetails {
	createdAt: string;
	id: string;
	kind: CategoryKind;
	name: string;
}

interface Category extends CategoryDetails {
	transactionCount: number;
}

interface NewCategory {
	kind: CategoryKind;
	name: string;
}

interface CategoryUpdate {
	kind?: CategoryKind;
	name?: string;
}

const CATEGORIES_URL = './api/v1/categories';
const CONFLICT_STATUS = 409;

class CategoriesApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

function isCategoryKind(value: unknown): value is CategoryKind {
	return value === CATEGORY_KIND.EXPENSE || value === CATEGORY_KIND.INCOME;
}

function isCategoryDetails(value: unknown): value is CategoryDetails {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof value.id === 'string' &&
		'name' in value &&
		typeof value.name === 'string' &&
		'kind' in value &&
		isCategoryKind(value.kind) &&
		'createdAt' in value &&
		typeof value.createdAt === 'string'
	);
}

function isCategory(value: unknown): value is Category {
	return isCategoryDetails(value) && 'transactionCount' in value && typeof value.transactionCount === 'number';
}

function isCategoryPage(value: unknown): value is { items: Category[] } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'items' in value &&
		Array.isArray(value.items) &&
		value.items.every((item: unknown) => isCategory(item))
	);
}

async function readError(response: Response): Promise<CategoriesApiError> {
	let message = `Request failed with HTTP ${String(response.status)}`;
	try {
		const body: unknown = await response.json();
		if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
			message = body.error;
		}
	} catch {
		// Keep the generic message when the body is not JSON.
	}

	return new CategoriesApiError(message, response.status);
}

async function fetchCategories(kind?: CategoryKind, signal?: AbortSignal): Promise<Category[]> {
	const parameters = new URLSearchParams();
	if (kind !== undefined) {
		parameters.set('kind', kind);
	}
	const serialized = parameters.toString();
	const response = await fetch(`${CATEGORIES_URL}${serialized ? `?${serialized}` : ''}`, {
		headers: { Accept: 'application/json' },
		...(signal && { signal }),
	});
	if (!response.ok) {
		throw await readError(response);
	}
	const page: unknown = await response.json();
	if (!isCategoryPage(page)) {
		throw new TypeError('Category list response was invalid');
	}

	return page.items;
}

async function createCategory(input: NewCategory): Promise<CategoryDetails> {
	const response = await fetch(CATEGORIES_URL, {
		body: JSON.stringify(input),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw await readError(response);
	}
	const category: unknown = await response.json();
	if (!isCategoryDetails(category)) {
		throw new TypeError('Category response was invalid');
	}

	return category;
}

async function updateCategory(id: string, input: CategoryUpdate): Promise<CategoryDetails> {
	const response = await fetch(`${CATEGORIES_URL}/${encodeURIComponent(id)}`, {
		body: JSON.stringify(input),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		method: 'PATCH',
	});
	if (!response.ok) {
		throw await readError(response);
	}
	const category: unknown = await response.json();
	if (!isCategoryDetails(category)) {
		throw new TypeError('Category response was invalid');
	}

	return category;
}

async function deleteCategory(id: string): Promise<void> {
	const response = await fetch(`${CATEGORIES_URL}/${encodeURIComponent(id)}`, {
		headers: { Accept: 'application/json' },
		method: 'DELETE',
	});
	if (!response.ok) {
		throw await readError(response);
	}
}

export {
	CategoriesApiError,
	type Category,
	CATEGORY_KIND,
	type CategoryDetails,
	type CategoryKind,
	type CategoryUpdate,
	CONFLICT_STATUS,
	createCategory,
	deleteCategory,
	fetchCategories,
	isCategoryKind,
	type NewCategory,
	updateCategory,
};
