interface McpTool {
	description: string;
	inputSchema: { properties: Record<string, unknown>; required?: string[]; type: 'object' };
	name: string;
}

const TOOLS: McpTool[] = [
	{ description: 'List the household finance books.', inputSchema: objectSchema(), name: 'list_books' },
	{
		description: 'Create an isolated finance book.',
		inputSchema: objectSchema(
			{ currencyCode: stringProperty('ISO 4217 currency code'), name: stringProperty('Book name') },
			['currencyCode', 'name']
		),
		name: 'create_book',
	},
	{
		description: 'List accounts in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeClosed: booleanProperty('Include closed accounts') },
			['bookId']
		),
		name: 'list_accounts',
	},
	{
		description: 'Create an account in its book currency.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				kind: stringProperty('Account kind'),
				name: stringProperty('Account name'),
				openingBalanceMinor: integerProperty('Opening balance in exact minor units'),
			},
			['bookId', 'kind', 'name', 'openingBalanceMinor']
		),
		name: 'create_account',
	},
	{
		description: 'Close an account without deleting its ledger.',
		inputSchema: objectSchema({ accountId: stringProperty('Account ID'), bookId: stringProperty('Book ID') }, [
			'accountId',
			'bookId',
		]),
		name: 'close_account',
	},
	{
		description: 'Reopen a previously closed account.',
		inputSchema: objectSchema({ accountId: stringProperty('Account ID'), bookId: stringProperty('Book ID') }, [
			'accountId',
			'bookId',
		]),
		name: 'reopen_account',
	},
	{
		description: 'Create a category, optionally under a parent category.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				name: stringProperty('Category name'),
				parentId: stringProperty('Optional parent category ID'),
			},
			['bookId', 'name']
		),
		name: 'create_category',
	},
	{
		description: 'Create a class, optionally under a parent class.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				name: stringProperty('Class name'),
				parentId: stringProperty('Optional parent class ID'),
			},
			['bookId', 'name']
		),
		name: 'create_class',
	},
	{
		description: 'Update a category name or parent.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				classificationId: stringProperty('Category ID'),
				name: stringProperty('Optional category name'),
				parentId: stringProperty('Optional parent category ID'),
			},
			['bookId', 'classificationId']
		),
		name: 'update_category',
	},
	{
		description: 'Archive a category and its descendants.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), classificationId: stringProperty('Category ID') },
			['bookId', 'classificationId']
		),
		name: 'archive_category',
	},
	{
		description: 'Restore an archived category hierarchy.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), classificationId: stringProperty('Category ID') },
			['bookId', 'classificationId']
		),
		name: 'restore_category',
	},
	{
		description: 'Update a class name or parent.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				classificationId: stringProperty('Class ID'),
				name: stringProperty('Optional class name'),
				parentId: stringProperty('Optional parent class ID'),
			},
			['bookId', 'classificationId']
		),
		name: 'update_class',
	},
	{
		description: 'Archive a class and its descendants.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), classificationId: stringProperty('Class ID') }, [
			'bookId',
			'classificationId',
		]),
		name: 'archive_class',
	},
	{
		description: 'Restore an archived class hierarchy.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), classificationId: stringProperty('Class ID') }, [
			'bookId',
			'classificationId',
		]),
		name: 'restore_class',
	},

	{
		description: 'Get total, posted, and reconciled balances as exact minor-unit integers.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				asOf: stringProperty('Optional inclusive YYYY-MM-DD date'),
				bookId: stringProperty('Book ID'),
			},
			['accountId', 'bookId']
		),
		name: 'get_account_balances',
	},
	{
		description: 'Validate and preview a QIF or CSV statement without writing ledger rows.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Target account ID'),
				bookId: stringProperty('Book ID'),
				contentBase64: stringProperty('Base64-encoded file contents, at most 2 MiB'),
				format: stringProperty('qif, payee_csv, or statement_csv'),
				payeeDirectoryBase64: stringProperty('Optional base64-encoded payee directory CSV'),
			},
			['accountId', 'bookId', 'contentBase64', 'format']
		),
		name: 'preview_statement_import',
	},
	{
		description: 'Import a previously previewed statement into its target account.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Target account ID'),
				bookId: stringProperty('Book ID'),
				contentBase64: stringProperty('Base64-encoded file contents, at most 2 MiB'),
				format: stringProperty('qif, payee_csv, or statement_csv'),
				payeeDirectoryBase64: stringProperty('Optional base64-encoded payee directory CSV'),
			},
			['accountId', 'bookId', 'contentBase64', 'format']
		),
		name: 'commit_statement_import',
	},
	{
		description: 'List categories in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeArchived: booleanProperty('Include archived categories') },
			['bookId']
		),
		name: 'list_categories',
	},
	{
		description: 'List classes in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeArchived: booleanProperty('Include archived classes') },
			['bookId']
		),
		name: 'list_classes',
	},
	{
		description: 'List transactions for one account in a book.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				bookId: stringProperty('Book ID'),
				fromDate: stringProperty('Optional inclusive YYYY-MM-DD start date'),
				status: stringProperty('Optional transaction status'),
				toDate: stringProperty('Optional inclusive YYYY-MM-DD end date'),
			},
			['accountId', 'bookId']
		),
		name: 'list_transactions',
	},
	{
		description: 'Record a transaction; amountMinor is an exact signed integer.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				amountMinor: integerProperty('Signed minor units'),
				bookId: stringProperty('Book ID'),
				memo: stringProperty('Optional memo'),
				parts: transactionPartsProperty(),
				payee: stringProperty('Optional payee'),
				transactionDate: stringProperty('YYYY-MM-DD'),
			},
			['accountId', 'amountMinor', 'bookId', 'transactionDate']
		),
		name: 'create_transaction',
	},
	{
		description: 'Update an uncleared or cleared transaction.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Optional account ID'),
				amountMinor: integerProperty('Optional signed minor units'),
				bookId: stringProperty('Book ID'),
				memo: stringProperty('Optional memo'),
				parts: transactionPartsProperty(),
				payee: stringProperty('Optional payee'),
				transactionDate: stringProperty('Optional YYYY-MM-DD date'),
				transactionId: stringProperty('Transaction ID'),
			},
			['bookId', 'transactionId']
		),
		name: 'update_transaction',
	},
	{
		description: 'Transfer exact minor units between accounts in one book.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Positive minor units'),
				bookId: stringProperty('Book ID'),
				fromAccountId: stringProperty('Source account ID'),
				memo: stringProperty('Optional memo'),
				toAccountId: stringProperty('Destination account ID'),
				transactionDate: stringProperty('YYYY-MM-DD'),
			},
			['amountMinor', 'bookId', 'fromAccountId', 'toAccountId', 'transactionDate']
		),
		name: 'create_transfer',
	},
	{
		description: 'Move a transaction through supported uncleared, cleared, and reconciled states.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				status: stringProperty('Target status'),
				transactionId: stringProperty('Transaction ID'),
			},
			['bookId', 'status', 'transactionId']
		),
		name: 'set_transaction_status',
	},
	{
		description: 'Delete a non-reconciled transaction.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), transactionId: stringProperty('Transaction ID') },
			['bookId', 'transactionId']
		),
		name: 'delete_transaction',
	},
	{
		description: 'List budgets in a book, optionally filtered by account.',
		inputSchema: objectSchema(
			{ accountId: stringProperty('Optional account ID'), bookId: stringProperty('Book ID') },
			['bookId']
		),
		name: 'list_budgets',
	},
	{
		description: 'Create a budget for an inclusive date period using exact minor units.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				bookId: stringProperty('Book ID'),
				categoryId: stringProperty('Optional category ID'),
				classId: stringProperty('Optional class ID'),
				name: stringProperty('Budget name'),
				periodEnd: stringProperty('Inclusive YYYY-MM-DD end date'),
				periodStart: stringProperty('Inclusive YYYY-MM-DD start date'),
				plannedMinor: integerProperty('Planned amount in minor units'),
			},
			['accountId', 'bookId', 'name', 'periodEnd', 'periodStart', 'plannedMinor']
		),
		name: 'create_budget',
	},
	{
		description: 'Get planned, actual, and remaining budget amounts.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), budgetId: stringProperty('Budget ID') }, [
			'bookId',
			'budgetId',
		]),
		name: 'get_budget_report',
	},
	{
		description: 'List scheduled payments in a book.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID') }, ['bookId']),
		name: 'list_schedules',
	},
	{
		description: 'Create a forecast schedule; this does not post a ledger transaction.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				amountMinor: integerProperty('Signed amount in minor units'),
				bookId: stringProperty('Book ID'),
				endDate: stringProperty('Optional inclusive YYYY-MM-DD end date'),
				frequency: {
					description: 'Recurrence frequency',
					enum: ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
					type: 'string',
				},
				interval: integerProperty('Optional recurrence interval'),
				memo: stringProperty('Optional memo'),
				occurrenceLimit: integerProperty('Optional maximum occurrence count'),
				payee: stringProperty('Optional payee'),
				startDate: stringProperty('First YYYY-MM-DD due date'),
			},
			['accountId', 'amountMinor', 'bookId', 'frequency', 'startDate']
		),
		name: 'create_schedule',
	},
	{
		description: 'Update details of a scheduled payment without changing past occurrences.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Optional signed minor units'),
				bookId: stringProperty('Book ID'),
				endDate: stringProperty('Optional YYYY-MM-DD end date'),
				memo: stringProperty('Optional memo'),
				occurrenceLimit: integerProperty('Optional maximum occurrence count'),
				payee: stringProperty('Optional payee'),
				scheduleId: stringProperty('Schedule ID'),
			},
			['bookId', 'scheduleId']
		),
		name: 'update_schedule',
	},
	{
		description: 'Pause, resume, or cancel a scheduled payment.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				scheduleId: stringProperty('Schedule ID'),
				status: {
					description: 'Target schedule status',
					enum: ['active', 'paused', 'canceled'],
					type: 'string',
				},
			},
			['bookId', 'scheduleId', 'status']
		),
		name: 'change_schedule_status',
	},
	{
		description: 'List persisted forecast occurrences for a scheduled payment.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), scheduleId: stringProperty('Schedule ID') }, [
			'bookId',
			'scheduleId',
		]),
		name: 'list_schedule_occurrences',
	},
	{
		description: 'Generate bounded forecast occurrences through an inclusive date; does not post transactions.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				maxOccurrences: integerProperty('Optional batch limit, maximum 500'),
				scheduleId: stringProperty('Schedule ID'),
				throughDate: stringProperty('Inclusive YYYY-MM-DD date'),
			},
			['bookId', 'scheduleId', 'throughDate']
		),
		name: 'generate_schedule_occurrences',
	},
	{
		description: 'Link an occurrence to an existing matching ledger transaction; does not create one.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				occurrenceId: stringProperty('Occurrence ID'),
				transactionId: stringProperty('Existing transaction ID'),
			},
			['bookId', 'occurrenceId', 'transactionId']
		),
		name: 'record_schedule_occurrence',
	},
	{
		description: 'List participants in a book, optionally including removed identities.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeRemoved: booleanProperty('Include removed participants') },
			['bookId']
		),
		name: 'list_shared_expense_participants',
	},
	{
		description: 'Add a participant identity to a book.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				id: stringProperty('Stable participant ID'),
				name: stringProperty('Participant display name'),
			},
			['bookId', 'id', 'name']
		),
		name: 'create_shared_expense_participant',
	},
	{
		description: 'Soft-remove a participant while preserving historical allocations.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), participantId: stringProperty('Participant ID') },
			['bookId', 'participantId']
		),
		name: 'remove_shared_expense_participant',
	},
	{
		description: 'List expenses and their allocations and settlements.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeClosed: booleanProperty('Include closed expenses') },
			['bookId']
		),
		name: 'list_shared_expenses',
	},
	{
		description: 'Allocate a positive expense among active participants; actor attribution remains separate.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Positive expense amount in minor units'),
				bookId: stringProperty('Book ID'),
				description: stringProperty('Expense description'),
				participantIds: { items: stringProperty('Participant ID'), type: 'array' },
			},
			['amountMinor', 'bookId', 'description', 'participantIds']
		),
		name: 'create_shared_expense',
	},
	{
		description: 'Close a shared expense to further settlements.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), expenseId: stringProperty('Expense ID') }, [
			'bookId',
			'expenseId',
		]),
		name: 'close_shared_expense',
	},
	{
		description: 'Reopen a closed shared expense.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), expenseId: stringProperty('Expense ID') }, [
			'bookId',
			'expenseId',
		]),
		name: 'reopen_shared_expense',
	},
	{
		description: 'Record explicit settlement by a participant, distinct from a ledger transfer.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				expenseId: stringProperty('Expense ID'),
				participantId: stringProperty('Participant ID'),
			},
			['bookId', 'expenseId', 'participantId']
		),
		name: 'settle_shared_expense',
	},
];

function objectSchema(properties: Record<string, unknown> = {}, required?: string[]) {
	return { properties, ...(required && { required }), type: 'object' as const };
}

function stringProperty(description: string) {
	return { description, type: 'string' };
}

function integerProperty(description: string) {
	return { description, type: 'integer' };
}

function booleanProperty(description: string) {
	return { description, type: 'boolean' };
}

function transactionPartsProperty() {
	return {
		description: 'Optional complete split of the transaction into exact minor-unit parts',
		items: {
			properties: {
				amountMinor: integerProperty('Signed minor units'),
				categoryId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
				classId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
				memo: stringProperty('Optional part memo'),
			},
			required: ['amountMinor'],
			type: 'object',
		},
		type: 'array',
	};
}

export { TOOLS };
