import type { CategoryProperties } from './category';
import { Category } from './category';

export class CategoryMother {
	static create(overrides: Partial<CategoryProperties> = {}): Category {
		return Category.create({
			createdAt: '2026-05-15T10:00:00.000Z',
			id: 'category-1',
			kind: 'expense',
			name: 'Groceries',
			...overrides,
		});
	}
}
