import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { RequestParsing } from '@modules/api/infrastructure/http/shared/request-parsing';
import type { Category, CategorySummary } from '@modules/ledger/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import type { FinanceEnvironment } from './finance-route-support';

const categoryKindSchema = z.enum(['expense', 'income'], {
	error: 'kind must be expense or income',
});

const listCategoriesQuerySchema = z.object({
	kind: categoryKindSchema.optional(),
});

const newCategorySchema = z.object({
	kind: categoryKindSchema,
	name: RequestParsing.requiredText('name'),
});

const updateCategorySchema = z.object({
	kind: categoryKindSchema.optional(),
	name: RequestParsing.requiredText('name').optional(),
});

interface CategoryJson {
	createdAt: string;
	id: string;
	kind: string;
	name: string;
}

interface CategorySummaryJson extends CategoryJson {
	scheduledTransactionCount: number;
	transactionCount: number;
}

class CategoryJsonMapper {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static toJson(category: Category): CategoryJson {
		return {
			createdAt: category.createdAt,
			id: category.id,
			kind: category.kind,
			name: category.name,
		};
	}

	static toSummary({ category, scheduledTransactionCount, transactionCount }: CategorySummary): CategorySummaryJson {
		return { ...this.toJson(category), scheduledTransactionCount, transactionCount };
	}
}

class CategoryRoutes {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): Hono<FinanceEnvironment> {
		const routes = new Hono<FinanceEnvironment>();

		routes
			.get('/categories', async context => {
				const { kind } = RequestParsing.parseInput(listCategoriesQuerySchema, context.req.query());
				const summaries = await context.var.useCases.ledger.categories.list.execute({
					...(kind !== undefined && { kind }),
				});

				return HttpResponses.json({ items: summaries.map(summary => CategoryJsonMapper.toSummary(summary)) });
			})
			.post('/categories', async context => {
				const { kind, name } = await RequestParsing.readJsonBody(context.req.raw, newCategorySchema);
				const category = await context.var.useCases.ledger.categories.create.execute({ kind, name });

				return HttpResponses.json(CategoryJsonMapper.toJson(category), 201);
			})
			.patch('/categories/:id', async context => {
				const { kind, name } = await RequestParsing.readJsonBody(context.req.raw, updateCategorySchema);
				const category = await context.var.useCases.ledger.categories.update.execute({
					id: context.req.param('id'),
					...(kind !== undefined && { kind }),
					...(name !== undefined && { name }),
				});

				return HttpResponses.json(CategoryJsonMapper.toJson(category));
			})
			.delete('/categories/:id', async context => {
				await context.var.useCases.ledger.categories.delete.execute({ id: context.req.param('id') });

				return HttpResponses.noContent();
			})
			.all('/categories', () => HttpResponses.methodNotAllowed('GET, POST'))
			.all('/categories/:id', () => HttpResponses.methodNotAllowed('DELETE, PATCH'));

		return routes;
	}
}

export { CategoryRoutes };
