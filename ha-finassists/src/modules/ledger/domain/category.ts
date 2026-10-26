import {
	CategoryKindInvalidError,
	CategoryKindMismatchError,
	CategoryNameInvalidError,
	CategoryNameTooLongError,
} from './category.error';
import type { TransactionKind } from './transaction';

const CATEGORY_KIND = { EXPENSE: 'expense', INCOME: 'income' } as const;

type CategoryKind = (typeof CATEGORY_KIND)[keyof typeof CATEGORY_KIND];

const CATEGORY_KINDS: readonly CategoryKind[] = Object.values(CATEGORY_KIND);

const CATEGORY_NAME_MAX_LENGTH = 40;

interface CategoryProperties {
	createdAt: string;
	id: string;
	kind: CategoryKind;
	name: string;
}

class Category {
	private constructor(
		readonly id: string,
		readonly name: string,
		readonly kind: CategoryKind,
		readonly createdAt: string
	) {}

	static create(properties: CategoryProperties): Category {
		if (!CATEGORY_KINDS.includes(properties.kind)) {
			throw new CategoryKindInvalidError();
		}
		const name = properties.name.trim();
		if (name === '') {
			throw new CategoryNameInvalidError();
		}
		if (name.length > CATEGORY_NAME_MAX_LENGTH) {
			throw new CategoryNameTooLongError(CATEGORY_NAME_MAX_LENGTH);
		}

		return new Category(properties.id, name, properties.kind, properties.createdAt);
	}

	/**
	 * A transaction may only use a category of its own kind.
	 */
	assertAccepts(kind: TransactionKind): void {
		if (this.kind !== kind) {
			throw new CategoryKindMismatchError(kind);
		}
	}
}

export {
	Category,
	CATEGORY_KIND,
	CATEGORY_KINDS,
	CATEGORY_NAME_MAX_LENGTH,
	type CategoryKind,
	type CategoryProperties,
};
