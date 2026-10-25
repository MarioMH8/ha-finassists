interface McpTool {
	description: string;
	inputSchema: { properties: Record<string, unknown>; required?: string[]; type: 'object' };
	name: string;
}

function objectSchema(properties: Record<string, unknown> = {}, required?: string[]) {
	return { properties, ...(required && { required }), type: 'object' as const };
}

function stringProperty(description: string, extra: Record<string, unknown> = {}) {
	return { description, type: 'string', ...extra };
}

function integerProperty(description: string, extra: Record<string, unknown> = {}) {
	return { description, type: 'integer', ...extra };
}

const KIND_VALUES = ['expense', 'income'];

const TOOLS: McpTool[] = [
	{
		description: 'Create a category used to group expenses or incomes.',
		inputSchema: objectSchema(
			{
				kind: stringProperty('Whether the category groups expenses or incomes', { enum: KIND_VALUES }),
				name: stringProperty('Category name, unique within its kind, up to 40 characters', {
					maxLength: 40,
				}),
			},
			['kind', 'name']
		),
		name: 'create_category',
	},
	{
		description: 'Record an expense or an income.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Positive amount in exact minor units, for example cents', { minimum: 1 }),
				categoryId: stringProperty('Optional identifier of a category of the same kind'),
				description: stringProperty('Optional description, up to 200 characters', { maxLength: 200 }),
				kind: stringProperty('Whether the movement is an expense or an income', { enum: KIND_VALUES }),
				transactionDate: stringProperty('Date of the movement as YYYY-MM-DD'),
			},
			['amountMinor', 'kind', 'transactionDate']
		),
		name: 'create_transaction',
	},
	{
		description: 'Delete a category that no transaction uses.',
		inputSchema: objectSchema({ id: stringProperty('Identifier of the category to delete') }, ['id']),
		name: 'delete_category',
	},
	{
		description: 'Delete a recorded expense or income by its identifier.',
		inputSchema: objectSchema({ id: stringProperty('Identifier of the transaction to delete') }, ['id']),
		name: 'delete_transaction',
	},
	{
		description: 'List categories, optionally filtered by kind.',
		inputSchema: objectSchema({
			kind: stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
		}),
		name: 'list_categories',
	},
	{
		description: 'List expenses and incomes, newest first.',
		inputSchema: objectSchema({
			categoryId: stringProperty('Optional filter by category identifier'),
			fromDate: stringProperty('Optional inclusive start date as YYYY-MM-DD'),
			kind: stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
			limit: integerProperty('Page size from 1 to 100', { maximum: 100, minimum: 1 }),
			offset: integerProperty('Number of movements to skip', { minimum: 0 }),
			search: stringProperty('Optional text to match in the description'),
			toDate: stringProperty('Optional inclusive end date as YYYY-MM-DD'),
		}),
		name: 'list_transactions',
	},
];

export { TOOLS };
