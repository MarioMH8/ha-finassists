import { McpSchemas } from './mcp-schemas';

interface McpTool {
	description: string;
	inputSchema: { properties: Record<string, unknown>; required?: string[]; type: 'object' };
	name: string;
}

const KIND_VALUES = ['expense', 'income'];
const SCHEDULED_FREQUENCY_VALUES = ['once', 'daily', 'weekly', 'monthly', 'yearly'];
const SCHEDULED_POSTING_MODE_VALUES = ['automatic', 'manual'];
const SCHEDULED_STATUS_VALUES = ['active', 'paused', 'completed'];
const SCHEDULED_UPDATE_STATUS_VALUES = ['active', 'paused'];

const TOOLS: McpTool[] = [
	{
		description: 'Create a category used to group expenses or incomes.',
		inputSchema: McpSchemas.objectSchema(
			{
				kind: McpSchemas.stringProperty('Whether the category groups expenses or incomes', {
					enum: KIND_VALUES,
				}),
				name: McpSchemas.stringProperty('Category name, unique within its kind, up to 40 characters', {
					maxLength: 40,
				}),
			},
			['kind', 'name']
		),
		name: 'create_category',
	},
	{
		description:
			'Create a scheduled expense or income that can post automatically or wait for manual confirmation.',
		inputSchema: McpSchemas.objectSchema(
			{
				amountMinor: McpSchemas.integerProperty('Positive amount in exact minor units, for example cents', {
					minimum: 1,
				}),
				categoryId: McpSchemas.stringProperty('Optional identifier of a category of the same kind'),
				description: McpSchemas.stringProperty('Optional description, up to 200 characters', {
					maxLength: 200,
				}),
				endDate: McpSchemas.stringProperty('Optional inclusive last occurrence as YYYY-MM-DD'),
				frequency: McpSchemas.stringProperty('How often the schedule repeats', {
					enum: SCHEDULED_FREQUENCY_VALUES,
				}),
				interval: McpSchemas.integerProperty('Repeat every N days, weeks, months or years', {
					maximum: 999,
					minimum: 1,
				}),
				kind: McpSchemas.stringProperty('Whether the movement is an expense or an income', {
					enum: KIND_VALUES,
				}),
				postingMode: McpSchemas.stringProperty('Whether occurrences post automatically or need confirmation', {
					enum: SCHEDULED_POSTING_MODE_VALUES,
				}),
				startDate: McpSchemas.stringProperty('First occurrence as YYYY-MM-DD'),
			},
			['amountMinor', 'frequency', 'kind', 'startDate']
		),
		name: 'create_scheduled_transaction',
	},
	{
		description: 'Record an expense or an income.',
		inputSchema: McpSchemas.objectSchema(
			{
				amountMinor: McpSchemas.integerProperty('Positive amount in exact minor units, for example cents', {
					minimum: 1,
				}),
				categoryId: McpSchemas.stringProperty('Optional identifier of a category of the same kind'),
				description: McpSchemas.stringProperty('Optional description, up to 200 characters', {
					maxLength: 200,
				}),
				kind: McpSchemas.stringProperty('Whether the movement is an expense or an income', {
					enum: KIND_VALUES,
				}),
				transactionDate: McpSchemas.stringProperty('Date of the movement as YYYY-MM-DD'),
			},
			['amountMinor', 'kind', 'transactionDate']
		),
		name: 'create_transaction',
	},
	{
		description: 'Delete a category that no transaction uses.',
		inputSchema: McpSchemas.objectSchema(
			{ id: McpSchemas.stringProperty('Identifier of the category to delete') },
			['id']
		),
		name: 'delete_category',
	},
	{
		description: 'Delete a scheduled transaction without deleting transactions it already posted.',
		inputSchema: McpSchemas.objectSchema(
			{ id: McpSchemas.stringProperty('Identifier of the scheduled transaction to delete') },
			['id']
		),
		name: 'delete_scheduled_transaction',
	},
	{
		description: 'Delete a recorded expense or income by its identifier.',
		inputSchema: McpSchemas.objectSchema(
			{ id: McpSchemas.stringProperty('Identifier of the transaction to delete') },
			['id']
		),
		name: 'delete_transaction',
	},
	{
		description: 'List categories, optionally filtered by kind.',
		inputSchema: McpSchemas.objectSchema({
			kind: McpSchemas.stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
		}),
		name: 'list_categories',
	},
	{
		description: 'List scheduled transactions, with the next due dates first.',
		inputSchema: McpSchemas.objectSchema({
			categoryId: McpSchemas.stringProperty('Optional filter by category identifier'),
			dueThrough: McpSchemas.stringProperty('Optional latest next due date as YYYY-MM-DD'),
			kind: McpSchemas.stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
			limit: McpSchemas.integerProperty('Page size from 1 to 100', { maximum: 100, minimum: 1 }),
			offset: McpSchemas.integerProperty('Number of schedules to skip', { minimum: 0 }),
			postingMode: McpSchemas.stringProperty('Optional filter by posting mode', {
				enum: SCHEDULED_POSTING_MODE_VALUES,
			}),
			search: McpSchemas.stringProperty('Optional text to match in the description'),
			status: McpSchemas.stringProperty('Optional filter by status', { enum: SCHEDULED_STATUS_VALUES }),
		}),
		name: 'list_scheduled_transactions',
	},
	{
		description: 'List expenses and incomes, newest first.',
		inputSchema: McpSchemas.objectSchema({
			categoryId: McpSchemas.stringProperty('Optional filter by category identifier'),
			fromDate: McpSchemas.stringProperty('Optional inclusive start date as YYYY-MM-DD'),
			kind: McpSchemas.stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
			limit: McpSchemas.integerProperty('Page size from 1 to 100', { maximum: 100, minimum: 1 }),
			offset: McpSchemas.integerProperty('Number of movements to skip', { minimum: 0 }),
			search: McpSchemas.stringProperty('Optional text to match in the description'),
			toDate: McpSchemas.stringProperty('Optional inclusive end date as YYYY-MM-DD'),
		}),
		name: 'list_transactions',
	},
	{
		description: 'Project scheduled occurrences in a date range with totals and category breakdown.',
		inputSchema: McpSchemas.objectSchema({
			categoryId: McpSchemas.stringProperty('Optional filter by category identifier'),
			fromDate: McpSchemas.stringProperty('Optional inclusive start date as YYYY-MM-DD'),
			kind: McpSchemas.stringProperty('Optional filter by kind', { enum: KIND_VALUES }),
			limit: McpSchemas.integerProperty('Number of occurrences to return from 1 to 200', {
				maximum: 200,
				minimum: 1,
			}),
			offset: McpSchemas.integerProperty('Number of occurrences to skip', { minimum: 0 }),
			toDate: McpSchemas.stringProperty('Optional inclusive end date as YYYY-MM-DD'),
		}),
		name: 'list_upcoming_scheduled_transactions',
	},
	{
		description: 'Post the next due occurrence of a scheduled transaction.',
		inputSchema: McpSchemas.objectSchema(
			{ id: McpSchemas.stringProperty('Identifier of the scheduled transaction to post') },
			['id']
		),
		name: 'post_scheduled_transaction',
	},
	{
		description: 'Skip the next due occurrence without recording a transaction.',
		inputSchema: McpSchemas.objectSchema(
			{ id: McpSchemas.stringProperty('Identifier of the scheduled transaction to skip') },
			['id']
		),
		name: 'skip_scheduled_transaction',
	},
	{
		description: 'Update a scheduled transaction, including pausing or resuming it.',
		inputSchema: McpSchemas.objectSchema(
			{
				amountMinor: McpSchemas.integerProperty('Positive amount in exact minor units', { minimum: 1 }),
				categoryId: McpSchemas.stringProperty('Optional identifier of a category of the same kind'),
				description: McpSchemas.stringProperty('Optional description, up to 200 characters', {
					maxLength: 200,
				}),
				endDate: McpSchemas.stringProperty('Optional inclusive last occurrence as YYYY-MM-DD'),
				frequency: McpSchemas.stringProperty('How often the schedule repeats', {
					enum: SCHEDULED_FREQUENCY_VALUES,
				}),
				id: McpSchemas.stringProperty('Identifier of the scheduled transaction to update'),
				interval: McpSchemas.integerProperty('Repeat every N days, weeks, months or years', {
					maximum: 999,
					minimum: 1,
				}),
				kind: McpSchemas.stringProperty('Whether the movement is an expense or an income', {
					enum: KIND_VALUES,
				}),
				postingMode: McpSchemas.stringProperty('Whether occurrences post automatically or need confirmation', {
					enum: SCHEDULED_POSTING_MODE_VALUES,
				}),
				startDate: McpSchemas.stringProperty('First occurrence as YYYY-MM-DD'),
				status: McpSchemas.stringProperty('Pause or resume the schedule', {
					enum: SCHEDULED_UPDATE_STATUS_VALUES,
				}),
			},
			['id']
		),
		name: 'update_scheduled_transaction',
	},
];

export { TOOLS };
