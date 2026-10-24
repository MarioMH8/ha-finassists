import type { ClassificationKind } from '@modules/classifications/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed, noContent } from '../shared/http-responses';
import { compact, nullableReference, optionalText, readJsonBody, requiredText } from '../shared/request-parsing';
import type { FinanceEnvironment } from './finance-route-support';
import { isFlagEnabled, paginated } from './finance-route-support';

const newClassificationSchema = z.object({
	name: requiredText('name'),
	parentId: nullableReference('parentId'),
});

const updateClassificationSchema = z.object({
	name: optionalText('name'),
	parentId: nullableReference('parentId'),
});

function createClassificationRoutes(
	segment: 'categories' | 'classes',
	kind: ClassificationKind
): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();
	const collection = `/books/:bookId/${segment}` as const;
	const item = `${collection}/:classificationId` as const;

	routes
		.get(collection, context => {
			const query = context.req.query();
			const list = context.var.useCases.classifications.list[kind].execute(context.req.param('bookId'), {
				includeArchived: isFlagEnabled(query, 'includeArchived'),
			});

			return jsonResponse(paginated(list, query));
		})
		.post(collection, async context => {
			const body = await readJsonBody(context.req.raw, newClassificationSchema);

			return jsonResponse(
				context.var.useCases.classifications.create[kind].execute({
					...body,
					bookId: context.req.param('bookId'),
				}),
				201
			);
		})
		.all(collection, () => methodNotAllowed('GET, POST'));

	routes
		.patch(item, async context => {
			const body = await readJsonBody(context.req.raw, updateClassificationSchema);

			return jsonResponse(
				context.var.useCases.classifications.update[kind].execute(
					context.req.param('bookId'),
					context.req.param('classificationId'),
					compact(body)
				)
			);
		})
		.delete(item, context => {
			context.var.useCases.classifications.delete[kind].execute(
				context.req.param('bookId'),
				context.req.param('classificationId')
			);

			return noContent();
		})
		.all(item, () => methodNotAllowed('PATCH, DELETE'));

	for (const action of ['archive', 'restore'] as const) {
		routes
			.post(`${item}/${action}`, context =>
				jsonResponse(
					context.var.useCases.classifications[action][kind].execute(
						context.req.param('bookId'),
						context.req.param('classificationId')
					)
				)
			)
			.all(`${item}/${action}`, () => methodNotAllowed('POST'));
	}

	return routes;
}

export { createClassificationRoutes };
