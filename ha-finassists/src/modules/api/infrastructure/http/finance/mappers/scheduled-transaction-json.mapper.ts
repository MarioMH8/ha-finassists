import type { ScheduledTransaction } from '@modules/ledger/domain';

interface ScheduledTransactionJson {
	amountMinor: number;
	categoryId: null | string;
	createdAt: string;
	createdBy: null | string;
	currencyCode: string;
	description: string;
	endDate: null | string;
	frequency: string;
	id: string;
	interval: number;
	kind: string;
	nextDueDate: null | string;
	postingMode: string;
	startDate: string;
	status: string;
}

class ScheduledTransactionJsonMapper {
	private constructor() {}

	static toJson(schedule: ScheduledTransaction): ScheduledTransactionJson {
		return {
			amountMinor: schedule.amountMinor,
			categoryId: schedule.categoryId,
			createdAt: schedule.createdAt,
			createdBy: schedule.createdBy,
			currencyCode: schedule.currencyCode,
			description: schedule.description,
			endDate: schedule.endDate,
			frequency: schedule.frequency,
			id: schedule.id,
			interval: schedule.interval,
			kind: schedule.kind,
			nextDueDate: schedule.nextDueDate,
			postingMode: schedule.postingMode,
			startDate: schedule.startDate,
			status: schedule.status,
		};
	}
}

export { ScheduledTransactionJsonMapper };
