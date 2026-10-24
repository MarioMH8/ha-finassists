interface DateRange {
	fromDate: string;
	toDate: string;
}

function pad(value: number, length = 2): string {
	return String(value).padStart(length, '0');
}

function toIsoDate(date: Date): string {
	return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayIsoDate(now: Date = new Date()): string {
	return toIsoDate(now);
}

function currentMonthRange(now: Date = new Date()): DateRange {
	return {
		fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
		toDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
	};
}

function monthsRange(months: number, now: Date = new Date()): DateRange {
	const span = Math.max(1, months);

	return {
		fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() - (span - 1), 1)),
		toDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
	};
}

function isIsoDate(value: string): boolean {
	const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(value);
	if (!match?.groups) {
		return false;
	}
	const year = Number(match.groups.year);
	const month = Number(match.groups.month);
	const day = Number(match.groups.day);
	const date = new Date(Date.UTC(year, month - 1, day));

	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export { currentMonthRange, type DateRange, isIsoDate, monthsRange, todayIsoDate };
