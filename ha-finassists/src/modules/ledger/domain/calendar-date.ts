interface CalendarDateParts {
	day: number;
	month: number;
	year: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;

class CalendarDate {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static addDays(value: string, amount: number): string | undefined {
		if (!Number.isSafeInteger(amount)) {
			return undefined;
		}
		const date = this.parse(value);
		if (date === undefined) {
			return undefined;
		}
		const next = new Date(this.toUtcMilliseconds(date) + amount * MILLISECONDS_PER_DAY);
		const year = next.getUTCFullYear();
		if (year < 1 || year > 9999) {
			return undefined;
		}

		return this.format(year, next.getUTCMonth() + 1, next.getUTCDate());
	}

	static addMonths(value: string, amount: number): string | undefined {
		if (!Number.isSafeInteger(amount)) {
			return undefined;
		}
		const date = this.parse(value);
		if (date === undefined) {
			return undefined;
		}
		const totalMonths = date.year * 12 + date.month - 1 + amount;
		const year = Math.floor(totalMonths / 12);
		if (year < 1 || year > 9999) {
			return undefined;
		}
		const month = (((totalMonths % 12) + 12) % 12) + 1;

		return this.format(year, month, Math.min(date.day, this.daysInMonth(year, month)));
	}

	static addYears(value: string, amount: number): string | undefined {
		if (!Number.isSafeInteger(amount)) {
			return undefined;
		}
		const date = this.parse(value);
		if (date === undefined) {
			return undefined;
		}
		const year = date.year + amount;
		if (year < 1 || year > 9999) {
			return undefined;
		}

		return this.format(year, date.month, Math.min(date.day, this.daysInMonth(year, date.month)));
	}

	static daysBetween(from: string, to: string): number | undefined {
		const start = this.parse(from);
		const end = this.parse(to);
		if (start === undefined || end === undefined) {
			return undefined;
		}

		return Math.round((this.toUtcMilliseconds(end) - this.toUtcMilliseconds(start)) / MILLISECONDS_PER_DAY);
	}

	static format(year: number, month: number, day: number): string {
		return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	static isValid(value: string): boolean {
		return this.parse(value) !== undefined;
	}

	static parse(value: string): CalendarDateParts | undefined {
		if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
			return undefined;
		}
		const year = Number(value.slice(0, 4));
		const month = Number(value.slice(5, 7));
		const day = Number(value.slice(8, 10));
		if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > this.daysInMonth(year, month)) {
			return undefined;
		}

		return { day, month, year };
	}

	static todayInTimeZone(timeZone: string, now: Date = new Date()): string {
		const parts = new Intl.DateTimeFormat('en', {
			day: '2-digit',
			month: '2-digit',
			timeZone,
			year: 'numeric',
		}).formatToParts(now);
		const values = new Map(parts.map(part => [part.type, part.value]));
		const year = values.get('year');
		const month = values.get('month');
		const day = values.get('day');
		if (year === undefined || month === undefined || day === undefined) {
			throw new Error('Unable to resolve the current calendar date');
		}

		return `${year}-${month}-${day}`;
	}

	private static daysInMonth(year: number, month: number): number {
		if (month === 2) {
			return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
		}

		return [4, 6, 9, 11].includes(month) ? 30 : 31;
	}

	private static toUtcMilliseconds(date: CalendarDateParts): number {
		return Date.UTC(date.year, date.month - 1, date.day);
	}
}

export { CalendarDate };
