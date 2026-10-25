class FinAssistCard extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._busy = new Set();
		this._errorMessage = '';
		this._feedbackIsError = false;
	}

	setConfig(config) {
		this.config = config || {};
		this.render();
	}

	set hass(hass) {
		this._hass = hass;
		this.render();
	}

	getCardSize() {
		return 3;
	}

	render() {
		if (!this._hass || !this.config) {
			return;
		}
		const states = Object.values(this._hass.states);
		const inScope = state =>
			state.entity_id.startsWith('sensor.') &&
			state.attributes.integration_entry_id &&
			state.attributes.kind &&
			(!this.config.entry_id || state.attributes.integration_entry_id === this.config.entry_id);
		const sensors = states.filter(inScope);
				const available = state => state.state !== 'unavailable' && state.state !== 'unknown';
		const entryIds = new Set(sensors.map(state => state.attributes.integration_entry_id));
		const esc = value =>
			String(value ?? '').replaceAll(
				/[&<>"']/g,
				char => ({ '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[char]
			);
		const formatAmount = value => {
			const number = Number(value);

			return Number.isFinite(number)
				? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number)
				: esc(value);
		};
		const breakdownFor = state => {
			const attributes = state.attributes || {};
			const entries = Object.entries(attributes.by_category || {});
			const uncategorized = Number(attributes.uncategorized || 0);
			if (entries.length === 0 && !(uncategorized > 0)) {
				return '';
			}
			const label =
				attributes.kind === 'income' ? 'Income this month' : 'Expenses this month';
			const unit = esc(attributes.unit_of_measurement || '');
			const body = entries
				.sort(([, first], [, second]) => Number(second) - Number(first))
				.map(
					([name, value]) =>
						`<tr><th scope="row">${esc(name)}</th><td>${formatAmount(value)} ${unit}</td></tr>`
				)
				.join('');
			const uncategorizedRow =
				uncategorized > 0
					? `<tr><th scope="row">Uncategorized</th><td>${formatAmount(uncategorized)} ${unit}</td></tr>`
					: '';

			return `<details class="breakdown"><summary>${label} by category</summary>
            <table><caption class="visually-hidden">${label} by category</caption>
            <tbody>${body}${uncategorizedRow}</tbody></table></details>`;
		};
		const breakdowns = sensors
			.filter(state => available(state))
			.map(state => breakdownFor(state))
			.join('');
		const rows = sensors
			.map(state => {
				const label = state.attributes.kind === 'income' ? 'Income this month' : 'Expenses this month';
				const value = available(state)
					? `${esc(state.state)} ${esc(state.attributes.unit_of_measurement || '')}`
					: 'Unavailable';

				return `<tr><th scope="row">${label}${entryIds.size > 1 ? ` <small>${esc(state.attributes.integration_entry_id)}</small>` : ''}</th><td>${value}</td></tr>`;
			})
			.join('');
		this.shadowRoot.innerHTML = `
      <ha-card header="Fin Assist">
        <div class="content">
          ${
				sensors.length === 0
					? '<p role="status">Fin Assist is not connected or its sensors are unavailable.</p>'
					: `<table><caption class="visually-hidden">Fin Assist totals for the current month</caption>
            <tbody>${rows}</tbody></table>`
			}
          ${breakdowns}
          <button class="refresh" type="button" ${this._busy.has('refresh') ? 'disabled aria-busy="true"' : ''}>${this._busy.has('refresh') ? 'Refreshing…' : 'Refresh'}</button>
          <p class="feedback${this._feedbackIsError ? ' error' : ''}" role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${esc(this._errorMessage)}</p>
        </div>
      </ha-card>
      <style>
        :host { display: block; }
        .content { padding: 16px; color: var(--primary-text-color); }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th, td { padding: 9px 6px; border-bottom: 1px solid var(--divider-color); }
        td { text-align: right; font-variant-numeric: tabular-nums; }
        small { display: block; color: var(--secondary-text-color); margin-top: 4px; font-weight: normal; }
        caption.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        .breakdown { margin-top: 12px; }
        .breakdown summary { cursor: pointer; font-weight: 500; padding: 6px 0; }
        .breakdown td { font-variant-numeric: tabular-nums; }
        button { font: inherit; color: var(--primary-color); background: transparent; border: 1px solid var(--divider-color); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
        button:hover { background: var(--secondary-background-color); }
        button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .refresh { margin-top: 14px; }
        .feedback { min-height: 1.25em; margin: 8px 0 0; }
        .feedback.error { color: var(--error-color); }
      </style>`;
		this.shadowRoot.querySelector('.refresh')?.addEventListener('click', () => {
			this._runAction(
				'refresh',
				() => {
					if (!this.config.entry_id && entryIds.size === 0) {
						throw new Error('No integration entry');
					}

					const entryId =
						this.config.entry_id ||
						(entryIds.size === 1 ? entryIds.values().next().value : undefined);
					return this._hass.callService(
						'ha_finassists',
						'refresh',
						entryId ? { entry_id: entryId } : {}
					);
				},
				'Refreshing Fin Assist…',
				'Fin Assist was refreshed.',
				'Fin Assist could not be refreshed. Check the integration connection and try again.'
			);
		});
	}

	async _runAction(key, action, pendingMessage, successMessage, errorMessage) {
		if (this._busy.has(key)) {
			return;
		}
		this._busy.add(key);
		this._errorMessage = pendingMessage;
		this._feedbackIsError = false;
		this.render();
		try {
			await action();
			this._errorMessage = successMessage;
		} catch {
			this._errorMessage = errorMessage;
			this._feedbackIsError = true;
		} finally {
			this._busy.delete(key);
			this.render();
			this.shadowRoot.querySelector('.feedback')?.focus();
		}
	}
}

if (!customElements.get('fin-assist-card')) {
	customElements.define('fin-assist-card', FinAssistCard);
}
globalThis.customCards = globalThis.customCards || [];
if (globalThis.customCards.every(card => card.type !== 'fin-assist-card')) {
	globalThis.customCards.push({
		description: 'Income and expenses recorded this month',
		name: 'Fin Assist',
		type: 'fin-assist-card',
	});
}
