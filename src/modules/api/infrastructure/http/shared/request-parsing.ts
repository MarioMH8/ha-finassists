/* eslint-disable typescript/explicit-module-boundary-types -- Zod builders rely on inferred schema types. */
import { z } from 'zod';

import { JSON_NULL } from './http-responses';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== JSON_NULL && !Array.isArray(value);
}

/**
 *Validates a value and reports the first issue as a `TypeError`, which the HTTP error handlers map to 400.
 */
function parseInput<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
	const result = schema.safeParse(value);
	if (!result.success) {
		throw new TypeError(result.error.issues[0]?.message ?? 'Invalid request');
	}

	return result.data;
}

async function readJsonBody<Schema extends z.ZodType>(request: Request, schema: Schema): Promise<z.output<Schema>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new TypeError('Invalid JSON body');
	}
	if (!isRecord(body)) {
		throw new TypeError('Request body must be a JSON object');
	}

	return parseInput(schema, body);
}

function requiredText(name: string) {
	const error = `${name} must be a non-empty string`;

	return z.string({ error }).refine(value => value.trim() !== '', { error });
}

function optionalText(name: string) {
	return z
		.string({ error: `${name} must be a string` })
		.nullish()
		.transform(value => value ?? undefined);
}

function optionalNumber(name: string) {
	return z
		.number({ error: `${name} must be a number` })
		.nullish()
		.transform(value => value ?? undefined);
}

/**
 *A reference that may be a string, an explicit `null` (no reference) or absent.
 */
function nullableReference(name: string) {
	return z
		.string({ error: `${name} must be a string or null` })
		.nullable()
		.optional();
}

function minorUnits(name = 'amountMinor') {
	const error = `${name} must be a safe integer`;

	return z.number({ error }).refine(value => Number.isSafeInteger(value), { error });
}

function stringArray(name: string) {
	const error = `${name} must be an array of strings`;

	return z.array(z.string({ error }), { error });
}

function nonNegativeInteger(name: string, maximum: number) {
	return z
		.string({ error: `${name} must be a non-negative integer` })
		.regex(/^\d+$/u, { error: `${name} must be a non-negative integer` })
		.transform(Number)
		.refine(value => Number.isSafeInteger(value) && value <= maximum, {
			error: `${name} cannot exceed ${maximum.toString()}`,
		});
}

/**
 *Drops keys whose value is `undefined`, so partial updates only carry fields the client sent.
 */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export {
	compact,
	isRecord,
	minorUnits,
	nonNegativeInteger,
	nullableReference,
	optionalNumber,
	optionalText,
	parseInput,
	readJsonBody,
	requiredText,
	stringArray,
};
