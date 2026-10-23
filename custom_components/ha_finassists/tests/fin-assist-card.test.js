import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const cardSource = readFileSync(
	new URL('../www/fin-assist-card.js', import.meta.url),
	'utf8'
);

class FakeButton {
	constructor(attributes = {}) {
		this.dataset = {
			status: attributes['data-status'],
			entry: attributes['data-entry'],
			book: attributes['data-book'],
			schedule: attributes['data-schedule'],
		};
		this.listeners = {};
	}

	addEventListener(event, listener) {
		this.listeners[event] = listener;
	}

	click() {
		this.listeners.click?.();
	}
}

class FakeShadowRoot {
	set innerHTML(html) {
		this.html = html;
		this.buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, rawAttributes]) => {
			const attributes = Object.fromEntries(
				[...rawAttributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])
			);
			return new FakeButton(attributes);
		});
	}

	querySelectorAll(selector) {
		return selector === 'button[data-status]'
			? this.buttons.filter(button => button.dataset.status)
			: [];
	}

	querySelector(selector) {
		if (selector === '.refresh') {
			return this.buttons.find(button => !button.dataset.status);
		}
		return selector === '.feedback' ? { focus() {} } : undefined;
	}
}

class FakeHTMLElement {
	attachShadow() {
		this.shadowRoot = new FakeShadowRoot();
		return this.shadowRoot;
	}
}

function loadCard() {
	const elements = new Map();
	const customCards = [];
	runInNewContext(cardSource, {
		HTMLElement: FakeHTMLElement,
		customElements: {
			get: name => elements.get(name),
			define: (name, element) => elements.set(name, element),
		},
		globalThis: { customCards },
	});
	return new (elements.get('fin-assist-card'))();
}

function scheduleSensor(entryId, schedule, state = '1', extra = {}) {
	return {
		entity_id: `sensor.${entryId}_schedules`,
		state,
		attributes: {
			integration_entry_id: entryId,
			schedules: [schedule],
			...extra,
		},
	};
}

function balanceSensor(entryId, state = '100.00') {
	return {
		entity_id: `sensor.${entryId}_balance`,
		state,
		attributes: {
			account_id: `${entryId}-account`,
			account_name: `${entryId} account`,
			account_kind: 'checking',
			integration_entry_id: entryId,
			total_minor: 10000,
			unit_of_measurement: 'USD',
		},
	};
}

describe('Fin Assist Lovelace card', () => {
	it('routes schedule actions to the entry that owns each schedule', () => {
		const card = loadCard();
		const calls = [];
		card.setConfig({});
		card.hass = {
			states: {
				first_balance: balanceSensor('entry-one'),
				second_balance: balanceSensor('entry-two'),
				first_schedules: scheduleSensor('entry-one', {
					bookId: 'book-one',
					id: 'schedule-one',
					payee: 'First payee',
					status: 'active',
				}),
				second_schedules: scheduleSensor('entry-two', {
					bookId: 'book-two',
					id: 'schedule-two',
					payee: 'Second payee',
					status: 'active',
				}),
			},
			callService: (...args) => calls.push(args),
		};

		const scheduleActions = card.shadowRoot.querySelectorAll('button[data-status]');
		expect(scheduleActions).toHaveLength(4);
		scheduleActions[2].click();

		expect(calls[0]).toEqual([
			'ha_finassists',
			'set_schedule_status',
			{
				book_id: 'book-two',
				entry_id: 'entry-two',
				schedule_id: 'schedule-two',
				status: 'paused',
			},
		]);
	});

	it('refreshes a configured entry even when its entities are not loaded yet', () => {
		const card = loadCard();
		const calls = [];
		card.setConfig({ entry_id: 'configured-entry' });
		card.hass = {
			states: {},
			callService: (...args) => calls.push(args),
		};

		card.shadowRoot.querySelector('.refresh').click();

		expect(calls).toEqual([
			['ha_finassists', 'refresh', { entry_id: 'configured-entry' }],
		]);
	});

	it('hides unavailable entity attributes and warns when retained schedules may be stale', () => {
		const card = loadCard();
		card.setConfig({});
		card.hass = {
			states: {
				unavailable_balance: balanceSensor('entry-one', 'unavailable'),
				unavailable_schedules: scheduleSensor(
					'entry-one',
					{ bookId: 'book-one', id: 'stale', payee: 'Stale payee', status: 'active' },
					'unavailable',
					{ schedule_refresh_failed: true }
				),
				current_schedules: scheduleSensor(
					'entry-two',
					{ bookId: 'book-two', id: 'current', payee: 'Current payee', status: 'active' },
					'1',
					{ schedule_refresh_failed: true }
				),
			},
			callService() {},
		};

		expect(card.shadowRoot.html).not.toContain('Stale payee');
		expect(card.shadowRoot.html).toContain('Current payee');
		expect(card.shadowRoot.html).toContain('Schedule data may be out of date.');
	});
});
