import { Hono } from 'hono';
import { z } from 'zod';

import { jsonResponse, methodNotAllowed, noContent } from '../shared/http-responses';
import { readJsonBody, requiredText } from '../shared/request-parsing';
import type { FinanceEnvironment } from './finance-route-support';
import { paginated } from './finance-route-support';

const newBookSchema = z.object({
	currencyCode: requiredText('currencyCode'),
	name: requiredText('name'),
});

function createBookRoutes(): Hono<FinanceEnvironment> {
	const routes = new Hono<FinanceEnvironment>();

	routes
		.get('/books', context =>
			jsonResponse(paginated(context.var.useCases.books.list.execute(), context.req.query()))
		)
		.post('/books', async context => {
			const body = await readJsonBody(context.req.raw, newBookSchema);

			return jsonResponse(context.var.useCases.books.create.execute(body), 201);
		})
		.all('/books', () => methodNotAllowed('GET, POST'));

	routes
		.delete('/books/:bookId', context =>
			context.var.useCases.books.delete.execute(context.req.param('bookId'))
				? noContent()
				: jsonResponse({ error: 'Book is not empty or does not exist' }, 409)
		)
		.all('/books/:bookId', () => methodNotAllowed('DELETE'));

	routes
		.post('/books/:bookId/archive', context =>
			context.var.useCases.books.archive.execute(context.req.param('bookId'))
				? noContent()
				: jsonResponse({ error: 'Book not found' }, 404)
		)
		.all('/books/:bookId/archive', () => methodNotAllowed('POST'));

	return routes;
}

export { createBookRoutes };
