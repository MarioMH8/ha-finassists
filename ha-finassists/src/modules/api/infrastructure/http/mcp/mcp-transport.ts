import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-routes';
import type {
	SystemCredentialUseCases,
	TokenManagementUseCases,
} from '@modules/api/infrastructure/http/shared/request-context';
import { APP_VERSION } from '@modules/version';

import { McpToolExecution } from './mcp-tool-execution';
import { TOOLS } from './mcp-tools';

const MCP_PROTOCOL_VERSION = {
	CURRENT: '2025-11-25',
} as const;
const MCP_MAX_BODY_BYTES = 6 * 1024 * 1024;
const JSON_RPC_NULL = JSON.parse('null') as null;
const MCP_SERVER_INFO = { name: 'fin-assist', version: APP_VERSION };

interface JsonRpcRequest {
	id?: number | string;
	jsonrpc: '2.0';
	method: string;
	params?: unknown;
}

class McpTransport {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async handle(
		request: Request,
		tokenUseCases: TokenManagementUseCases,
		useCases: FinanceUseCases,
		systemCredentialUseCases?: SystemCredentialUseCases
	): Promise<Response> {
		if (!this.hasValidOrigin(request)) {
			return new Response('Forbidden', { status: 403 });
		}
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { headers: { Allow: 'POST' }, status: 405 });
		}
		if (!this.hasAcceptedMcpJson(request)) {
			return new Response('Not Acceptable', { status: 406 });
		}
		const authorizationParts = (request.headers.get('authorization') ?? '').trim().split(/\s+/u, 3);
		const [scheme = '', secret = ''] = authorizationParts;
		if (!secret || authorizationParts.length !== 2 || scheme.toLowerCase() !== 'bearer') {
			return this.jsonResponse({ error: 'Authentication required' }, 401);
		}
		let actor: undefined | { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' };
		if (systemCredentialUseCases !== undefined) {
			const credential = await systemCredentialUseCases.authenticate.execute(secret);
			if (credential) {
				actor = { id: credential.id, kind: 'home_assistant_integration' };
			}
		}
		if (actor === undefined) {
			const token = await tokenUseCases.authenticate.execute(secret);
			if (!token) {
				return this.jsonResponse({ error: 'Authentication required' }, 401);
			}
			actor = { id: token.ownerId, kind: 'home_assistant_user' };
		}
		if ((request.headers.get('content-type') ?? '').split(';', 1).join('').trim() !== 'application/json') {
			return new Response('Unsupported Media Type', { status: 415 });
		}

		let message: unknown;
		try {
			message = await this.readLimitedJson(request);
		} catch (error) {
			if (error instanceof RangeError) {
				return this.jsonResponse({ error: error.message }, 413);
			}

			return this.rpcError(JSON_RPC_NULL, -32_700, 'Parse error');
		}
		if (Array.isArray(message)) {
			return this.rpcError(JSON_RPC_NULL, -32_600, 'Batch requests are not supported');
		}
		if (!this.isRecord(message) || !this.isJsonRpcRequest(message)) {
			return this.rpcError(JSON_RPC_NULL, -32_600, 'Invalid Request');
		}
		const rpcRequest = message;
		if (!Object.hasOwn(message, 'id') && !rpcRequest.method.startsWith('notifications/')) {
			return this.rpcError(JSON_RPC_NULL, -32_600, 'Requests must include an id');
		}
		const protocolVersion = request.headers.get('mcp-protocol-version') ?? MCP_PROTOCOL_VERSION.CURRENT;
		if (protocolVersion !== MCP_PROTOCOL_VERSION.CURRENT) {
			return this.rpcError(rpcRequest.id ?? JSON_RPC_NULL, -32_600, 'Unsupported MCP protocol version');
		}
		try {
			return await this.processRpc(rpcRequest, protocolVersion, actor, useCases);
		} catch {
			return this.rpcError(rpcRequest.id ?? JSON_RPC_NULL, -32_603, 'Internal error');
		}
	}

	private static hasAcceptedMcpJson(request: Request): boolean {
		const accepted = new Set(
			(request.headers.get('accept') ?? '').split(',').map(value => value.split(';', 1)[0]?.trim().toLowerCase())
		);

		return accepted.has('application/json') && accepted.has('text/event-stream');
	}

	private static hasValidOrigin(request: Request): boolean {
		const origin = request.headers.get('origin');
		if (origin === null) {
			return true;
		}
		try {
			return new URL(origin).origin === new URL(request.url).origin;
		} catch {
			return false;
		}
	}

	private static isJsonRpcRequest(value: Record<string, unknown>): value is JsonRpcRequest & Record<string, unknown> {
		return (
			value.jsonrpc === '2.0' &&
			typeof value.method === 'string' &&
			(!Object.hasOwn(value, 'id') || typeof value.id === 'string' || typeof value.id === 'number')
		);
	}

	private static isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	private static jsonResponse(body: unknown, status = 200): Response {
		return Response.json(body, {
			headers: { 'Cache-Control': 'no-store', 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION.CURRENT },
			status,
		});
	}

	private static async processRpc(
		message: JsonRpcRequest,
		protocolVersion: string,
		actor: { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' },
		useCases: FinanceUseCases
	): Promise<Response> {
		if (message.id === undefined && message.method.startsWith('notifications/')) {
			return new Response(JSON_RPC_NULL, {
				headers: { 'Cache-Control': 'no-store', 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION.CURRENT },
				status: 202,
			});
		}
		if (message.method === 'ping') {
			return this.jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result: {} });
		}
		if (message.method === 'initialize') {
			const parameters = this.isRecord(message.params) ? message.params : {};
			const requested = parameters.protocolVersion;
			if (typeof requested !== 'string') {
				return this.rpcError(message.id ?? JSON_RPC_NULL, -32_602, 'protocolVersion is required');
			}

			return this.jsonResponse({
				id: message.id ?? JSON_RPC_NULL,
				jsonrpc: '2.0',
				result: {
					capabilities: { tools: { listChanged: false } },
					protocolVersion: MCP_PROTOCOL_VERSION.CURRENT,
					serverInfo: MCP_SERVER_INFO,
				},
			});
		}
		if (message.method === 'tools/list') {
			return this.jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result: { tools: TOOLS } });
		}
		if (message.method === 'tools/call') {
			const parameters = this.isRecord(message.params) ? message.params : {};
			const toolArguments = parameters.arguments ?? {};
			if (typeof parameters.name !== 'string' || !this.isRecord(toolArguments)) {
				return this.rpcError(
					message.id ?? JSON_RPC_NULL,
					-32_602,
					'A tool name and object arguments are required'
				);
			}
			const result = await McpToolExecution.invokeTool(parameters.name, toolArguments, actor, useCases);

			return result === undefined
				? this.rpcError(message.id ?? JSON_RPC_NULL, -32_602, `Unknown tool: ${parameters.name}`)
				: this.jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result });
		}
		void protocolVersion;

		return this.rpcError(message.id ?? JSON_RPC_NULL, -32_601, `Method not found: ${message.method}`);
	}

	private static async readLimitedJson(request: Request): Promise<unknown> {
		const body = request.body;
		if (body === null) {
			throw new SyntaxError('MCP request body is required');
		}
		const chunks: Uint8Array[] = [];
		let length = 0;
		for await (const value of body) {
			length += value.byteLength;
			if (length > MCP_MAX_BODY_BYTES) {
				throw new RangeError('MCP request body exceeds the 6 MiB limit');
			}
			chunks.push(value);
		}
		const bytes = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}

		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
	}

	private static rpcError(id: JsonRpcRequest['id'] | null, code: number, message: string): Response {
		return this.jsonResponse({ error: { code, message }, id: id ?? JSON_RPC_NULL, jsonrpc: '2.0' });
	}
}

export { MCP_MAX_BODY_BYTES, MCP_PROTOCOL_VERSION, McpTransport };

export { TOOLS } from './mcp-tools';
