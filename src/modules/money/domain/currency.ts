export class Currency {
	private constructor(
		readonly code: string,
		readonly fractionDigits: number
	) {}

	static create(code: string): Currency {
		const normalized = code.trim().toUpperCase();
		if (!/^[A-Z]{3}$/.test(normalized)) {
			throw new Error('Currency must be a three-letter ISO 4217 code');
		}

		let fractionDigits: number;
		try {
			fractionDigits =
				new Intl.NumberFormat('en', { currency: normalized, style: 'currency' }).resolvedOptions()
					.maximumFractionDigits ?? 2;
		} catch {
			throw new Error(`Unsupported currency: ${normalized}`);
		}

		return new Currency(normalized, fractionDigits);
	}
}
