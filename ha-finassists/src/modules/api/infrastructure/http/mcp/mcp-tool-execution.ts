import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-routes';
import { handleFinanceRequest } from '@modules/api/infrastructure/http/finance/finance-routes';

const LIST_FILTERS = ['fromDate', 'kind', 'limit', 'offset', 'search', 'toDate'] as const;

function textResult(value: unknown): { content: { text: string; type: 'text' }[]; structuredContent: unknown } {
	return { content: [{ text: JSON.stringify(value), type: 'text' }], structuredContent: value };
}

function getToolRequest(
	name: string,
	arguments_: Record<string, unknown>
): undefined | { body?: unknown; method: string; path: string } {
	switch (name) {
		case 'create_transaction': {
			return {
				body: {
					amountMinor: arguments_.amountMinor,
					kind: arguments_.kind,
					transactionDate: arguments_.transactionDate,
					...(typeof arguments_.description === 'string' && { description: arguments_.description }),
				},
				method: 'POST',
				path: '/api/v1/transactions',
			};
		}
		case 'delete_transaction': {
			return { method: 'DELETE', path: `/api/v1/transactions/${encodeURIComponent(String(arguments_.id))}` };
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
	const text = await response.text();
	const value: unknown = text === '' ? undefined : JSON.parse(text);

	return { isError: !response.ok, ...textResult(value) };
}

export { invokeTool };
