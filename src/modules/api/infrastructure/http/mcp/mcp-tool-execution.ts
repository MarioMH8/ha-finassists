import { Buffer } from 'node:buffer';

import type { ImportFormat } from '@modules/imports/domain';
import { DEFAULT_IMPORT_LIMITS, IMPORT_FORMATS, ImportError } from '@modules/imports/domain';

import type { FinanceUseCases } from '../finance/finance-routes';
import { handleFinanceRequest } from '../finance/finance-routes';

const JSON_RPC_NULL = JSON.parse('null') as null;

function readStringArgument(arguments_: Record<string, unknown>, key: string): string {
	const value = arguments_[key];

	return typeof value === 'string' ? value : '';
}

function textResult(value: unknown): { content: { text: string; type: 'text' }[]; structuredContent: unknown } {
	return { content: [{ text: JSON.stringify(value), type: 'text' }], structuredContent: value };
}

function decodeImportContent(value: unknown, fieldName: string): Uint8Array {
	if (typeof value !== 'string' || !/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/u.test(value)) {
		throw new TypeError(`${fieldName} must be valid base64`);
	}
	const decoded = Buffer.from(value, 'base64');
	if (decoded.byteLength > DEFAULT_IMPORT_LIMITS.maxBytes || decoded.toString('base64') !== value) {
		throw new RangeError(`${fieldName} exceeds the 2 MiB limit or is not canonical base64`);
	}

	return new Uint8Array(decoded);
}

function getToolRequest(
	name: string,
	arguments_: Record<string, unknown>
): undefined | { body?: unknown; method: string; path: string } {
	const bookId = typeof arguments_.bookId === 'string' ? encodeURIComponent(arguments_.bookId) : '';
	switch (name) {
		case 'archive_category': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/archive`,
			};
		}
		case 'archive_class': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/archive`,
			};
		}
		case 'change_schedule_status': {
			return {
				body: { status: arguments_.status },
				method: 'PUT',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/status`,
			};
		}
		case 'close_account': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/close`,
			};
		}
		case 'close_shared_expense': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/close`,
			};
		}
		case 'create_account': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/accounts` };
		}
		case 'create_book': {
			return { body: arguments_, method: 'POST', path: '/api/v1/books' };
		}
		case 'create_budget': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/budgets` };
		}
		case 'create_category': {
			return {
				body: { name: arguments_.name, parentId: arguments_.parentId ?? JSON_RPC_NULL },
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories`,
			};
		}
		case 'create_class': {
			return {
				body: { name: arguments_.name, parentId: arguments_.parentId ?? JSON_RPC_NULL },
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes`,
			};
		}
		case 'create_schedule': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/schedules` };
		}
		case 'create_shared_expense': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/shared-expenses` };
		}
		case 'create_shared_expense_participant': {
			return {
				body: { id: arguments_.id, name: arguments_.name },
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expense-participants`,
			};
		}
		case 'create_transaction': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/transactions` };
		}
		case 'create_transfer': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/transfers` };
		}
		case 'delete_transaction': {
			return {
				method: 'DELETE',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}`,
			};
		}
		case 'generate_schedule_occurrences': {
			return {
				body: {
					...(typeof arguments_.maxOccurrences === 'number' && { maxOccurrences: arguments_.maxOccurrences }),
					throughDate: arguments_.throughDate,
				},
				method: 'POST',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/occurrences`,
			};
		}
		case 'get_account_balances': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/balances${typeof arguments_.asOf === 'string' ? `?asOf=${encodeURIComponent(arguments_.asOf)}` : ''}`,
			};
		}
		case 'get_budget_report': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/budgets/${encodeURIComponent(readStringArgument(arguments_, 'budgetId'))}/report`,
			};
		}
		case 'list_accounts': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/accounts${arguments_.includeClosed === true ? '?includeClosed=true' : ''}`,
			};
		}
		case 'list_books': {
			return { method: 'GET', path: '/api/v1/books' };
		}
		case 'list_budgets': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/budgets${typeof arguments_.accountId === 'string' ? `?accountId=${encodeURIComponent(arguments_.accountId)}` : ''}`,
			};
		}
		case 'list_categories': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/categories${arguments_.includeArchived === true ? '?includeArchived=true' : ''}`,
			};
		}
		case 'list_classes': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/classes${arguments_.includeArchived === true ? '?includeArchived=true' : ''}`,
			};
		}
		case 'list_schedule_occurrences': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/occurrences`,
			};
		}
		case 'list_schedules': {
			return { method: 'GET', path: `/api/v1/books/${bookId}/schedules` };
		}
		case 'list_shared_expense_participants': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/shared-expense-participants${arguments_.includeRemoved === true ? '?includeRemoved=true' : ''}`,
			};
		}
		case 'list_shared_expenses': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/shared-expenses${arguments_.includeClosed === true ? '?includeClosed=true' : ''}`,
			};
		}
		case 'list_transactions': {
			const query = new URLSearchParams({ accountId: readStringArgument(arguments_, 'accountId') });
			for (const key of ['fromDate', 'status', 'toDate'] as const) {
				if (typeof arguments_[key] === 'string') {
					query.set(key, arguments_[key]);
				}
			}

			return { method: 'GET', path: `/api/v1/books/${bookId}/transactions?${query.toString()}` };
		}
		case 'record_schedule_occurrence': {
			return {
				body: { transactionId: arguments_.transactionId },
				method: 'POST',
				path: `/api/v1/books/${bookId}/schedule-occurrences/${encodeURIComponent(readStringArgument(arguments_, 'occurrenceId'))}/record`,
			};
		}
		case 'remove_shared_expense_participant': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expense-participants/${encodeURIComponent(readStringArgument(arguments_, 'participantId'))}/remove`,
			};
		}
		case 'reopen_account': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/open`,
			};
		}
		case 'reopen_shared_expense': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/reopen`,
			};
		}
		case 'restore_category': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/restore`,
			};
		}
		case 'restore_class': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/restore`,
			};
		}
		case 'set_transaction_status': {
			return {
				body: { status: arguments_.status },
				method: 'PUT',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}/status`,
			};
		}
		case 'settle_shared_expense': {
			return {
				body: { participantId: arguments_.participantId },
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/settle`,
			};
		}
		case 'update_category': {
			return {
				body: {
					...(typeof arguments_.name === 'string' && { name: arguments_.name }),
					...('parentId' in arguments_ && { parentId: arguments_.parentId }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}`,
			};
		}
		case 'update_class': {
			return {
				body: {
					...(typeof arguments_.name === 'string' && { name: arguments_.name }),
					...('parentId' in arguments_ && { parentId: arguments_.parentId }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}`,
			};
		}
		case 'update_schedule': {
			return {
				body: {
					...(typeof arguments_.amountMinor === 'number' && { amountMinor: arguments_.amountMinor }),
					...(typeof arguments_.endDate === 'string' && { endDate: arguments_.endDate }),
					...(typeof arguments_.memo === 'string' && { memo: arguments_.memo }),
					...(typeof arguments_.occurrenceLimit === 'number' && {
						occurrenceLimit: arguments_.occurrenceLimit,
					}),
					...(typeof arguments_.payee === 'string' && { payee: arguments_.payee }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}`,
			};
		}
		case 'update_transaction': {
			return {
				body: {
					...(typeof arguments_.accountId === 'string' && { accountId: arguments_.accountId }),
					...(typeof arguments_.amountMinor === 'number' && { amountMinor: arguments_.amountMinor }),
					...(typeof arguments_.memo === 'string' && { memo: arguments_.memo }),
					...(Array.isArray(arguments_.parts) && { parts: arguments_.parts }),
					...(typeof arguments_.payee === 'string' && { payee: arguments_.payee }),
					...(typeof arguments_.transactionDate === 'string' && {
						transactionDate: arguments_.transactionDate,
					}),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}`,
			};
		}
		default: {
			return undefined;
		}
	}
}

async function invokeTool(
	name: string,
	arguments_: Record<string, unknown>,
	actor: { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' },
	useCases: FinanceUseCases
): Promise<undefined | { content: { text: string; type: 'text' }[]; isError: boolean; structuredContent: unknown }> {
	const actorId = actor.id;
	if (name === 'preview_statement_import' || name === 'commit_statement_import') {
		try {
			const format = arguments_.format;
			if (typeof format !== 'string' || !(IMPORT_FORMATS as readonly string[]).includes(format)) {
				throw new TypeError('format is invalid');
			}
			const input = {
				accountId: typeof arguments_.accountId === 'string' ? arguments_.accountId : '',
				actorId,
				bookId: typeof arguments_.bookId === 'string' ? arguments_.bookId : '',
				content: decodeImportContent(arguments_.contentBase64, 'contentBase64'),
				format: format as ImportFormat,
				...(arguments_.payeeDirectoryBase64 !== undefined && {
					payeeDirectory: decodeImportContent(arguments_.payeeDirectoryBase64, 'payeeDirectoryBase64'),
				}),
			};
			const value =
				name === 'preview_statement_import'
					? useCases.imports.preview.execute(input)
					: useCases.imports.commit.execute(input);

			return { isError: false, ...textResult(value) };
		} catch (error) {
			const message =
				error instanceof ImportError || error instanceof TypeError || error instanceof RangeError
					? error.message
					: 'The import could not be completed';

			return { isError: true, ...textResult({ error: message }) };
		}
	}

	const toolRequest = getToolRequest(name, arguments_);
	if (!toolRequest) {
		return;
	}
	const response = await handleFinanceRequest(
		new Request(`http://fin-assist${toolRequest.path}`, {
			method: toolRequest.method,
			...(toolRequest.body !== undefined && {
				body: JSON.stringify(toolRequest.body),
				headers: { 'Content-Type': 'application/json' },
			}),
		}),
		actor,
		useCases
	);
	const value = response.status === 204 ? { status: 'ok' } : (JSON.parse(await response.text()) as unknown);

	return { isError: !response.ok, ...textResult(value) };
}

export { invokeTool };
