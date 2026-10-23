import type { Language } from '@app/i18n/language';

const ACTOR_KIND = {
	HOME_ASSISTANT_INTEGRATION: 'home_assistant_integration',
	HOME_ASSISTANT_USER: 'home_assistant_user',
	UNKNOWN: 'unknown',
} as const;

const SETTLEMENT_STATUS = {
	PENDING: 'pending',
	SETTLED: 'settled',
} as const;

type ActorKind = (typeof ACTOR_KIND)[keyof typeof ACTOR_KIND];
type SettlementStatus = (typeof SETTLEMENT_STATUS)[keyof typeof SETTLEMENT_STATUS];

interface Actor {
	id?: string;
	kind: ActorKind;
}

interface Participant {
	bookId: string;
	createdAt: string;
	id: string;
	name: string;
	removedAt?: string;
}

interface Allocation {
	amountMinor: number;
	participantId: string;
	participantName: string;
}

interface Settlement {
	amountMinor: number;
	participantId: string;
	settledAt?: string;
	settledByActor?: Actor;
	status: SettlementStatus;
}

interface SharedExpense {
	actor: Actor;
	allocations: Allocation[];
	amountMinor: number;
	bookId: string;
	closedAt?: string;
	createdAt: string;
	description: string;
	id: string;
	settlements: Settlement[];
}

interface Page<T> {
	items: T[];
	limit: number;
	offset: number;
	total: number;
}

interface CreateExpenseInput {
	amountMinor: number;
	description: string;
	participantIds: string[];
}

interface CreateParticipantInput {
	id: string;
	name: string;
}

function isPage<T>(value: unknown): value is Page<T> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'items' in value &&
		Array.isArray(value.items) &&
		'total' in value &&
		typeof value.total === 'number' &&
		Number.isSafeInteger(value.total) &&
		'offset' in value &&
		typeof value.offset === 'number' &&
		Number.isSafeInteger(value.offset) &&
		'limit' in value &&
		typeof value.limit === 'number' &&
		Number.isSafeInteger(value.limit)
	);
}

async function loadAllPageItems<T>(path: string, signal?: AbortSignal): Promise<T[]> {
	async function loadPage(offset: number, collected: T[]): Promise<T[]> {
		const query = new URLSearchParams({ limit: '100', offset: String(offset) });
		const separator = path.includes('?') ? '&' : '?';
		const page: unknown = await request<unknown>(`${path}${separator}${query.toString()}`, { signal });
		if (
			!isPage<T>(page) ||
			page.offset !== offset ||
			page.limit <= 0 ||
			page.items.length > page.limit ||
			page.total < offset + page.items.length ||
			(page.items.length === 0 && page.total > offset)
		) {
			throw new TypeError('The server returned an invalid list.');
		}
		const allItems = [...collected, ...page.items];

		return allItems.length < page.total ? loadPage(allItems.length, allItems) : allItems;
	}

	return loadPage(0, []);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	if (!response.ok) {
		let message = `HTTP ${String(response.status)}`;
		try {
			const body: unknown = await response.json();
			if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
				message = body.error;
			}
		} catch {
			// Keep the status message when the response has no JSON body.
		}
		throw new Error(message);
	}
	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

function json(method: string, body?: unknown): RequestInit {
	return {
		...(body !== undefined && { body: JSON.stringify(body) }),
		headers: { 'content-type': 'application/json' },
		method,
	};
}

function sharedExpensePath(bookId: string, resource: string): string {
	return `/api/v1/books/${encodeURIComponent(bookId)}/${resource}`;
}

function currencyFractionDigits(currencyCode: string): number {
	return (
		new Intl.NumberFormat('en', { currency: currencyCode, style: 'currency' }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

function parseAmount(value: string, currencyCode: string): number {
	const normalized = value.trim().replace(',', '.');
	const match = /^(?:(?<whole>\d+)(?:\.(?<fraction>\d*))?|\.(?<leadingFraction>\d+))$/u.exec(normalized);
	if (!match) {
		throw new TypeError('Invalid amount');
	}

	const fractionDigits = currencyFractionDigits(currencyCode);
	const fraction = match.groups?.fraction ?? match.groups?.leadingFraction ?? '';
	if (fraction.length > fractionDigits) {
		throw new TypeError('Invalid amount');
	}
	const scale = 10n ** BigInt(fractionDigits);
	const minor = BigInt(match.groups?.whole ?? '0') * scale + BigInt(fraction.padEnd(fractionDigits, '0') || '0');
	if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new TypeError('Invalid amount');
	}

	return Number(minor);
}

function formatMinorUnits(value: number, currencyCode: string, language: Language): string {
	const digits = currencyFractionDigits(currencyCode);
	const scale = 10n ** BigInt(digits);
	const absolute = BigInt(value) < 0n ? -BigInt(value) : BigInt(value);
	const whole = absolute / scale;
	const remainder = absolute % scale;
	const currencyParts = new Intl.NumberFormat(language, {
		currency: currencyCode,
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
		style: 'currency',
	}).formatToParts(value < 0 ? -1 : 1);
	const wholeParts = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).formatToParts(Number(whole));
	const integerParts = wholeParts.filter(part => part.type === 'integer' || part.type === 'group');
	const fractionParts =
		digits === 0
			? []
			: [
					...currencyParts.filter(part => part.type === 'decimal'),
					{
						type: 'fraction',
						value: new Intl.NumberFormat(language, {
							maximumFractionDigits: 0,
							minimumIntegerDigits: digits,
						}).format(Number(remainder)),
					},
				];
	const numericTypes = new Set(['decimal', 'fraction', 'group', 'integer']);
	let isInsertedNumber = false;

	return currencyParts
		.flatMap(part => {
			if (!numericTypes.has(part.type)) {
				return [part.value];
			}
			if (isInsertedNumber) {
				return [];
			}
			isInsertedNumber = true;

			return [
				...integerParts.map(integerPart => integerPart.value),
				...fractionParts.map(fractionPart => fractionPart.value),
			];
		})
		.join('');
}

function formatDate(value: string, language: Language): string {
	const date = new Date(value);

	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}

export {
	type Actor,
	ACTOR_KIND,
	type CreateExpenseInput,
	type CreateParticipantInput,
	formatDate,
	formatMinorUnits,
	json,
	loadAllPageItems,
	parseAmount,
	type Participant,
	request,
	SETTLEMENT_STATUS,
	type SharedExpense,
	sharedExpensePath,
};
