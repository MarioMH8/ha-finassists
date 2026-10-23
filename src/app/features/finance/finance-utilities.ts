import type { Language } from '@app/i18n/language';

function currencyFractionDigits(currencyCode: string): number {
	return (
		new Intl.NumberFormat('en', { currency: currencyCode, style: 'currency' }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

function parseMinorUnits(value: string, currencyCode: string): number {
	const normalized = value.trim().replace(',', '.');
	const match = /^(?<sign>[+-]?)(?:(?<whole>\d+)(?:\.(?<fraction>\d*))?|\.(?<leadingFraction>\d+))$/u.exec(
		normalized
	);
	if (!match) {
		throw new TypeError('Enter a decimal amount without grouping separators.');
	}

	const groups = match.groups;
	const fractionDigits = currencyFractionDigits(currencyCode);
	const fraction = groups?.fraction ?? groups?.leadingFraction ?? '';
	if (fraction.length > fractionDigits) {
		throw new TypeError(`This currency allows at most ${String(fractionDigits)} decimal places.`);
	}
	const scale = 10n ** BigInt(fractionDigits);
	const whole = BigInt(groups?.whole ?? '0');
	const fractionMinor = BigInt(fraction.padEnd(fractionDigits, '0') || '0');
	const minor = (whole * scale + fractionMinor) * (groups?.sign === '-' ? -1n : 1n);
	if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new RangeError('Amount is outside the supported range.');
	}

	return Number(minor);
}

function minorUnitsToInput(value: number, currencyCode: string): string {
	const digits = currencyFractionDigits(currencyCode);
	const scale = 10n ** BigInt(digits);
	const absolute = BigInt(value) < 0n ? -BigInt(value) : BigInt(value);
	const whole = absolute / scale;
	const fraction = digits === 0 ? '' : `.${String(absolute % scale).padStart(digits, '0')}`;

	return `${value < 0 ? '-' : ''}${String(whole)}${fraction}`;
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
	const result = currencyParts.flatMap(part => {
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
	});

	return result.join('');
}

function formatDate(value: string, language: Language): string {
	const date = new Date(`${value}T12:00:00.000Z`);

	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export { currencyFractionDigits, formatDate, formatMinorUnits, minorUnitsToInput, parseMinorUnits };
