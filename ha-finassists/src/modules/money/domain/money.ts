import { Currency } from './currency';

export class Money {
	private constructor(
		readonly minorUnits: number,
		readonly currency: Currency
	) {}

	static fromMinor(minorUnits: number, currency: Currency): Money {
		if (!Number.isSafeInteger(minorUnits)) {
			throw new TypeError('Money minor units must be a safe integer');
		}

		return new Money(minorUnits, currency);
	}

	static parse(amount: string, currency: Currency): Money {
		const normalized = amount.trim();
		const match = /^(?<sign>-?)(?<whole>\d+)(?:\.(?<fraction>\d+))?$/.exec(normalized);
		if (!match?.groups) {
			throw new Error('Amount must be a decimal string without grouping separators');
		}

		const { fraction = '', sign, whole } = match.groups;
		if (whole === undefined) {
			throw new Error('Amount must be a decimal string without grouping separators');
		}

		const keptFraction = fraction.slice(0, currency.fractionDigits);
		const excessFraction = fraction.slice(currency.fractionDigits);
		if (/[1-9]/.test(excessFraction)) {
			throw new Error(
				`Amount exceeds ${currency.fractionDigits.toString()} fractional digits for ${currency.code}`
			);
		}

		const scale = 10n ** BigInt(currency.fractionDigits);
		const minorUnits = BigInt(whole) * scale + BigInt(keptFraction.padEnd(currency.fractionDigits, '0') || '0');
		const signedMinorUnits = sign === '-' ? -minorUnits : minorUnits;
		if (signedMinorUnits > BigInt(Number.MAX_SAFE_INTEGER) || signedMinorUnits < BigInt(Number.MIN_SAFE_INTEGER)) {
			throw new Error('Money amount exceeds the safe integer range');
		}

		return this.fromMinor(Number(signedMinorUnits), currency);
	}

	add(other: Money): Money {
		this.assertSameCurrency(other);

		return Money.fromMinor(this.minorUnits + other.minorUnits, this.currency);
	}

	format(locale: string): string {
		const divisor = 10 ** this.currency.fractionDigits;

		return new Intl.NumberFormat(locale, {
			currency: this.currency.code,
			minimumFractionDigits: this.currency.fractionDigits,
			style: 'currency',
		}).format(this.minorUnits / divisor);
	}

	subtract(other: Money): Money {
		this.assertSameCurrency(other);

		return Money.fromMinor(this.minorUnits - other.minorUnits, this.currency);
	}

	private assertSameCurrency(other: Money): void {
		if (this.currency.code !== other.currency.code) {
			throw new Error(`Cannot combine ${this.currency.code} and ${other.currency.code}`);
		}
	}
}
