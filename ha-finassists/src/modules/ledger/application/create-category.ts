import type { CategoryKind, CategoryRepository } from '../domain';
import { Category, CategoryNameAlreadyExistsError } from '../domain';

interface CreateCategoryInput {
	kind: CategoryKind;
	name: string;
}

export class CreateCategory {
	constructor(private readonly repository: CategoryRepository) {}

	async execute(input: CreateCategoryInput): Promise<Category> {
		const category = Category.create({
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			kind: input.kind,
			name: input.name,
		});
		const existing = await this.repository.findByName(category.kind, category.name);
		if (existing !== undefined) {
			throw new CategoryNameAlreadyExistsError(category.name);
		}
		await this.repository.save(category);

		return category;
	}
}

export type { CreateCategoryInput };
