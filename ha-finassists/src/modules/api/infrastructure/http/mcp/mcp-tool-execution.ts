import { FinanceFacade } from '@modules/api/infrastructure/http/finance/finance-facade';
import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-route-types';

const LIST_FILTERS = ['categoryId', 'fromDate', 'kind', 'limit', 'offset', 'search', 'toDate'] as const;
const SCHEDULED_LIST_FILTERS = [
	'categoryId',
	'dueThrough',
	'kind',
	'limit',
	'offset',
	'postingMode',
	'search',
	'status',
] as const;
const UPCOMING_FILTERS = ['categoryId', 'fromDate', 'kind', 'limit', 'offset', 'toDate'] as const;

class McpToolExecution {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async invokeTool(
		name: string,
		arguments_: Record<string, unknown>,
		actor: { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' },
		useCases: FinanceUseCases
	): Promise<
		undefined | { content: { text: string; type: 'text' }[]; isError: boolean; structuredContent: unknown }
	> {
		const toolRequest = this.getToolRequest(name, arguments_);
		if (!toolRequest) {
			return;
		}
		const response = await FinanceFacade.handle(
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
		const text = await response.text();
		const value: unknown = text === '' ? undefined : JSON.parse(text);

		return { isError: !response.ok, ...this.textResult(value) };
	}

	private static getToolRequest(
		name: string,
		arguments_: Record<string, unknown>
	): undefined | { body?: unknown; method: string; path: string } {
		switch (name) {
			case 'create_category': {
				return {
					body: { kind: arguments_.kind, name: arguments_.name },
					method: 'POST',
					path: '/api/v1/categories',
				};
			}
			case 'create_scheduled_transaction': {
				return {
					body: {
						amountMinor: arguments_.amountMinor,
						frequency: arguments_.frequency,
						kind: arguments_.kind,
						startDate: arguments_.startDate,
						...(typeof arguments_.categoryId === 'string' && { categoryId: arguments_.categoryId }),
						...(typeof arguments_.description === 'string' && { description: arguments_.description }),
						...(typeof arguments_.endDate === 'string' && { endDate: arguments_.endDate }),
						...(typeof arguments_.interval === 'number' && { interval: arguments_.interval }),
						...(typeof arguments_.postingMode === 'string' && {
							postingMode: arguments_.postingMode,
						}),
					},
					method: 'POST',
					path: '/api/v1/scheduled-transactions',
				};
			}
			case 'create_transaction': {
				return {
					body: {
						amountMinor: arguments_.amountMinor,
						kind: arguments_.kind,
						transactionDate: arguments_.transactionDate,
						...(typeof arguments_.categoryId === 'string' && { categoryId: arguments_.categoryId }),
						...(typeof arguments_.description === 'string' && { description: arguments_.description }),
					},
					method: 'POST',
					path: '/api/v1/transactions',
				};
			}
			case 'delete_category': {
				return { method: 'DELETE', path: `/api/v1/categories/${encodeURIComponent(String(arguments_.id))}` };
			}
			case 'delete_scheduled_transaction': {
				return {
					method: 'DELETE',
					path: `/api/v1/scheduled-transactions/${encodeURIComponent(String(arguments_.id))}`,
				};
			}
			case 'delete_transaction': {
				return { method: 'DELETE', path: `/api/v1/transactions/${encodeURIComponent(String(arguments_.id))}` };
			}
			case 'list_categories': {
				const query = new URLSearchParams();
				if (typeof arguments_.kind === 'string') {
					query.set('kind', arguments_.kind);
				}
				const suffix = query.size > 0 ? `?${query.toString()}` : '';

				return { method: 'GET', path: `/api/v1/categories${suffix}` };
			}
			case 'list_scheduled_transactions': {
				return {
					method: 'GET',
					path: this.queryPath('/api/v1/scheduled-transactions', SCHEDULED_LIST_FILTERS, arguments_),
				};
			}
			case 'list_transactions': {
				const query = new URLSearchParams();
				for (const filter of LIST_FILTERS) {
					const value = arguments_[filter];
					if (typeof value === 'string' || typeof value === 'number') {
						query.set(filter, String(value));
					}
				}
				const suffix = query.size > 0 ? `?${query.toString()}` : '';

				return { method: 'GET', path: `/api/v1/transactions${suffix}` };
			}
			case 'list_upcoming_scheduled_transactions': {
				return {
					method: 'GET',
					path: this.queryPath('/api/v1/scheduled-transactions/upcoming', UPCOMING_FILTERS, arguments_),
				};
			}
			case 'post_scheduled_transaction': {
				return {
					method: 'POST',
					path: `/api/v1/scheduled-transactions/${encodeURIComponent(String(arguments_.id))}/post`,
				};
			}
			case 'skip_scheduled_transaction': {
				return {
					method: 'POST',
					path: `/api/v1/scheduled-transactions/${encodeURIComponent(String(arguments_.id))}/skip`,
				};
			}
			case 'update_scheduled_transaction': {
				return {
					body: {
						...(typeof arguments_.amountMinor === 'number' && { amountMinor: arguments_.amountMinor }),
						...(typeof arguments_.categoryId === 'string' && { categoryId: arguments_.categoryId }),
						...(typeof arguments_.description === 'string' && { description: arguments_.description }),
						...(typeof arguments_.endDate === 'string' && { endDate: arguments_.endDate }),
						...(typeof arguments_.frequency === 'string' && { frequency: arguments_.frequency }),
						...(typeof arguments_.interval === 'number' && { interval: arguments_.interval }),
						...(typeof arguments_.kind === 'string' && { kind: arguments_.kind }),
						...(typeof arguments_.postingMode === 'string' && {
							postingMode: arguments_.postingMode,
						}),
						...(typeof arguments_.startDate === 'string' && { startDate: arguments_.startDate }),
						...(typeof arguments_.status === 'string' && { status: arguments_.status }),
					},
					method: 'PATCH',
					path: `/api/v1/scheduled-transactions/${encodeURIComponent(String(arguments_.id))}`,
				};
			}
			default: {
				return undefined;
			}
		}
	}

	private static queryPath(path: string, filters: readonly string[], arguments_: Record<string, unknown>): string {
		const query = new URLSearchParams();
		for (const filter of filters) {
			const value = arguments_[filter];
			if (typeof value === 'string' || typeof value === 'number') {
				query.set(filter, String(value));
			}
		}
		const suffix = query.size > 0 ? `?${query.toString()}` : '';

		return `${path}${suffix}`;
	}

	private static textResult(value: unknown): {
		content: { text: string; type: 'text' }[];
		structuredContent: unknown;
	} {
		return { content: [{ text: JSON.stringify(value), type: 'text' }], structuredContent: value };
	}
}

export { McpToolExecution };
