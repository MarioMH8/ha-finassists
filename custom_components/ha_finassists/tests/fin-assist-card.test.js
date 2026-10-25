import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const cardSource = readFileSync(
	new URL('../www/fin-assist-card.js', import.meta.url),
	'utf8'
);

class FakeButton {
	constructor() {
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
		this.refreshButton = new FakeButton();
	}

	querySelector(selector) {
		if (selector === '.refresh') {
			return this.refreshButton;
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

function totalSensor(entryId, kind, state = '10.00') {
	return {
		entity_id: `sensor.${entryId}_${kind}`,
		state,
		attributes: {
			integration_entry_id: entryId,
			kind,
			month: '2026-10',
			unit_of_measurement: 'EUR',
		},
	};
}

describe('Fin Assist Lovelace card', () => {
	it('shows income and expenses for the current month', () => {
		const card = loadCard();
		card.setConfig({});
		card.hass = {
			states: {
				income: totalSensor('entry-one', 'income', '1200.00'),
				expenses: totalSensor('entry-one', 'expense', '345.50'),
			},
			callService() {},
		};

		expect(card.shadowRoot.html).toContain('Income this month');
		expect(card.shadowRoot.html).toContain('1200.00 EUR');
		expect(card.shadowRoot.html).toContain('Expenses this month');
		expect(card.shadowRoot.html).toContain('345.50 EUR');
	});

	it('refreshes the only entry in scope', () => {
		const card = loadCard();
		const calls = [];
		card.setConfig({});
		card.hass = {
			states: { income: totalSensor('entry-one', 'income') },
			callService: (...args) => calls.push(args),
		};

		card.shadowRoot.querySelector('.refresh').click();

		expect(calls).toEqual([['ha_finassists', 'refresh', { entry_id: 'entry-one' }]]);
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

	it('only displays the configured entry and flags unavailable totals', () => {
		const card = loadCard();
		card.setConfig({ entry_id: 'entry-two' });
		card.hass = {
			states: {
				first: totalSensor('entry-one', 'income', '999.00'),
				second: totalSensor('entry-two', 'expense', 'unavailable'),
			},
			callService() {},
		};

		expect(card.shadowRoot.html).not.toContain('999.00');
		expect(card.shadowRoot.html).toContain('Unavailable');
	});
});
