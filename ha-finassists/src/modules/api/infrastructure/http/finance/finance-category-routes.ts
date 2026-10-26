import { jsonResponse, methodNotAllowed, noContent } from '@modules/api/infrastructure/http/shared/http-responses';
import { parseInput, readJsonBody, requiredText } from '@modules/api/infrastructure/http/shared/request-parsing';
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
	name: requiredText('name'),
});

const updateCategorySchema = z.object({
	kind: categoryKindSchema.optional(),
	name: requiredText('name').optional(),
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

function categoryJson(category: Category): CategoryJson {
	return {
		createdAt: category.createdAt,
		id: category.id,
		kind: category.kind,
		name: category.name,
	};
}

function categorySummaryJson({
	category,
	scheduledTransactionCount,
	transactionCount,
}: CategorySummary): CategorySummaryJson {
	return { ...categoryJson(category), scheduledTransactionCount, transactionCount };
}

function createCategoryRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();

	routes
		.get('/categories', async context => {
			const { kind } = parseInput(listCategoriesQuerySchema, context.req.query());
			const summaries = await context.var.useCases.ledger.categories.list.execute({
				...(kind !== undefined && { kind }),
			});

			return jsonResponse({ items: summaries.map(summary => categorySummaryJson(summary)) });
		})
		.post('/categories', async context => {
			const { kind, name } = await readJsonBody(context.req.raw, newCategorySchema);
			const category = await context.var.useCases.ledger.categories.create.execute({ kind, name });

			return jsonResponse(categoryJson(category), 201);
		})
		.patch('/categories/:id', async context => {
			const { kind, name } = await readJsonBody(context.req.raw, updateCategorySchema);
			const category = await context.var.useCases.ledger.categories.update.execute({
				id: context.req.param('id'),
				...(kind !== undefined && { kind }),
				...(name !== undefined && { name }),
			});

			return jsonResponse(categoryJson(category));
		})
		.delete('/categories/:id', async context => {
			await context.var.useCases.ledger.categories.delete.execute({ id: context.req.param('id') });

			return noContent();
		})
		.all('/categories', () => methodNotAllowed('GET, POST'))
		.all('/categories/:id', () => methodNotAllowed('DELETE, PATCH'));

	return routes;
}

export { createCategoryRoutes };
