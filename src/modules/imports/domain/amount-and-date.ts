import { FinancialTransaction } from '@modules/ledger/domain';

/**
 * Localized amount dialect (QIF): optional sign, digits, optional single decimal separator (`,` or `.`),
 * optional thousands separator (the other symbol, or space/NBSP). When both symbols appear, the last one is
 * the decimal separator. A lone separator is always the decimal separator, so `1,234` is 1.234 and fails
 * later if the currency has fewer fraction digits, instead of being silently read as 1234.
 * Returns a plain `-?\d+(\.\d+)?` string, or undefined when the text is not an amount.
 */
function normalizeLocalizedAmount(text: string): string | undefined {
	const compact = text.replaceAll(/[\s\u{A0}\u{202F}]/gu, '');
	const match = /^(?<sign>[+-]?)(?<body>[\d.,]+)$/.exec(compact);
	if (match === null) {
		return undefined;
	}
	const sign = match.groups?.sign === '-' ? '-' : '';
	const body = match.groups?.body ?? '';
	if (!/\d/.test(body)) {
		return undefined;
	}
	const lastComma = body.lastIndexOf(',');
	const lastDot = body.lastIndexOf('.');
	const decimalIndex = Math.max(lastComma, lastDot);
	if (decimalIndex === -1) {
		return `${sign}${body}`;
	}
	const decimalSymbol = body[decimalIndex];
	const otherSymbol = decimalSymbol === ',' ? '.' : ',';
	const integerPart = body.slice(0, decimalIndex);
	const fraction = body.slice(decimalIndex + 1);
	const hasOther = integerPart.includes(otherSymbol);
	if (integerPart.includes(decimalSymbol) || (!hasOther && integerPart.length === 0) || !/^\d+$/.test(fraction)) {
		return undefined;
	}
	if (hasOther && !new RegExp(String.raw`^\d{1,3}(?:[${otherSymbol}]\d{3})+$`).test(integerPart)) {
		return undefined;
	}
	const digits = integerPart.replaceAll(otherSymbol, '');
	if (!/^\d+$/.test(digits)) {
		return undefined;
	}

	return `${sign}${digits}.${fraction}`;
}

const STRICT_AMOUNT = /^-?\d+(?:\.\d+)?$/;

function normalizeStrictAmount(text: string): string | undefined {
	return STRICT_AMOUNT.test(text) ? text : undefined;
}

function toIsoDate(year: number, month: number, day: number): string | undefined {
	const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	try {
		FinancialTransaction.validateDate(value);
	} catch {
		return undefined;
	}

	return value;
}

/**
 * QIF date dialect (MS Comptes Bancaires, day first): DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, DD/MM'YY
 * and YYYY-MM-DD. Two-digit years 00-69 mean 2000-2069, 70-99 mean 1970-1999. US month-first dates are
 * ambiguous and therefore not supported. Impossible calendar dates are rejected.
 */
function parseDayFirstDate(text: string): string | undefined {
	const value = text.replaceAll(/\s+/g, '').replaceAll(String.fromCodePoint(39), '/');
	const iso = /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})$/.exec(value);
	if (iso !== null) {
		return toIsoDate(Number(iso.groups?.year), Number(iso.groups?.month), Number(iso.groups?.day));
	}
	const dayFirst = /^(?<day>\d{1,2})[./-](?<month>\d{1,2})[./-](?<year>\d{4}|\d{2})$/.exec(value);
	if (dayFirst === null) {
		return undefined;
	}
	const rawYear = dayFirst.groups?.year ?? '';
	const year = rawYear.length === 2 ? (Number(rawYear) <= 69 ? 2000 : 1900) + Number(rawYear) : Number(rawYear);

	return toIsoDate(year, Number(dayFirst.groups?.month), Number(dayFirst.groups?.day));
}

// Statement CSV dialect: strictly YYYY-MM-DD.
function parseIsoDate(text: string): string | undefined {
	const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(text);

	return match === null
		? undefined
		: toIsoDate(Number(match.groups?.year), Number(match.groups?.month), Number(match.groups?.day));
}

export { normalizeLocalizedAmount, normalizeStrictAmount, parseDayFirstDate, parseIsoDate };
