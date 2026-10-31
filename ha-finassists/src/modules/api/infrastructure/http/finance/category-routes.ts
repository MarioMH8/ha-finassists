import { HttpResponses } from '@modules/api/infrastructure/http/shared/http-responses';
import { RequestParsing } from '@modules/api/infrastructure/http/shared/request-parsing';
import { Hono } from 'hono';
import { z } from 'zod';

import type { FinanceEnvironment } from './finance-route-types';
import { CategoryJsonMapper } from './mappers/category-json.mapper';

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

class CategoryRoutes {
	private constructor() {}

	static create(): Hono<FinanceEnvironment> {
		const routes = new Hono<FinanceEnvironment>();
		for (const path of ['/categories', '/categories/*']) {
			routes.use(path, async (context, next) => {
				if (!context.var.features.capabilities.categories && context.req.method !== 'GET') {
					return HttpResponses.empty(404);
				}

				return next();
			});
		}

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
