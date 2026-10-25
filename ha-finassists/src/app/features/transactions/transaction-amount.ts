import type { Language } from '@app/i18n/language';

const AMOUNT_ERROR = {
	INVALID: 'invalid',
	NOT_POSITIVE: 'notPositive',
	PRECISION: 'precision',
	REQUIRED: 'required',
	TOO_LARGE: 'tooLarge',
} as const;

type AmountError = (typeof AMOUNT_ERROR)[keyof typeof AMOUNT_ERROR];

type AmountResult = { error: AmountError; minor?: undefined } | { error?: undefined; minor: number };

const AMOUNT_PATTERN = /^(?<sign>[+-]?)(?:(?<whole>\d+)(?:[.,](?<fraction>\d*))?|[.,](?<leadingFraction>\d+))$/u;

function currencyFractionDigits(currencyCode: string): number {
	return (
		new Intl.NumberFormat('en', { currency: currencyCode, style: 'currency' }).resolvedOptions()
			.maximumFractionDigits ?? 2
	);
}

function parseAmountMinor(value: string, currencyCode: string): AmountResult {
	const normalized = value.trim();
	if (!normalized) {
		return { error: AMOUNT_ERROR.REQUIRED };
	}

	const groups = AMOUNT_PATTERN.exec(normalized)?.groups as Partial<Record<string, string>> | undefined;
	if (!groups) {
		return { error: AMOUNT_ERROR.INVALID };
	}

	const fractionDigits = currencyFractionDigits(currencyCode);
	const fraction = groups.fraction ?? groups.leadingFraction ?? '';
	if (fraction.length > fractionDigits) {
		return { error: AMOUNT_ERROR.PRECISION };
	}

	const scale = 10n ** BigInt(fractionDigits);
	const minor = BigInt(groups.whole ?? '0') * scale + BigInt(fraction.padEnd(fractionDigits, '0') || '0');
	if (minor === 0n || groups.sign === '-') {
		return { error: AMOUNT_ERROR.NOT_POSITIVE };
	}
	if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
		return { error: AMOUNT_ERROR.TOO_LARGE };
	}

	return { minor: Number(minor) };
}

function formatMinorUnits(
	value: number,
	currencyCode: string,
	language: Language,
	signDisplay: 'auto' | 'exceptZero' = 'auto'
): string {
	const digits = currencyFractionDigits(currencyCode);

	return new Intl.NumberFormat(language, {
		currency: currencyCode,
		maximumFractionDigits: digits,
		minimumFractionDigits: digits,
		signDisplay,
		style: 'currency',
	}).format(value / 10 ** digits);
}

function formatDate(value: string, language: Language): string {
	const date = new Date(`${value}T12:00:00.000Z`);

	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export {
	AMOUNT_ERROR,
	type AmountError,
	type AmountResult,
	currencyFractionDigits,
	formatDate,
	formatMinorUnits,
	parseAmountMinor,
};
