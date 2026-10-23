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
		return 4;
	}

	render() {
		if (!this._hass || !this.config) {
			return;
		}
		const states = Object.values(this._hass.states);
		const balanceSensors = states.filter(
			state =>
				state.entity_id.startsWith('sensor.') &&
				state.attributes.account_id &&
				state.attributes.total_minor !== undefined
		);
		const scheduleSensors = states.filter(
			state =>
				state.entity_id.startsWith('sensor.') &&
				state.attributes.schedules &&
				state.attributes.integration_entry_id
		);
		const accounts = balanceSensors.filter(
			state =>
				state.state !== 'unavailable' &&
				state.state !== 'unknown' &&
				(!this.config.entry_id || state.attributes.integration_entry_id === this.config.entry_id)
		);
		const upcoming = scheduleSensors.filter(
			state =>
				state.state !== 'unavailable' &&
				state.state !== 'unknown' &&
				(!this.config.entry_id || state.attributes.integration_entry_id === this.config.entry_id)
		);
		const schedules = upcoming.flatMap(state =>
			(state.attributes.schedules || []).map(schedule => ({
				entryId: state.attributes.integration_entry_id,
				schedule,
			}))
		);
		const schedulesMayBeStale = upcoming.some(state => state.attributes.schedule_refresh_failed);
		const entryIds = new Set(
			[...balanceSensors, ...scheduleSensors]
				.filter(state => !this.config.entry_id || state.attributes.integration_entry_id === this.config.entry_id)
				.map(state => state.attributes.integration_entry_id)
		);
		const esc = value =>
			String(value ?? '').replaceAll(
				/[&<>"']/g,
				char => ({ '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[char]
			);
		const accountRows = accounts
			.map(
				state => `
      <tr><th scope="row">${esc(state.attributes.account_name)}</th>
        <td>${esc(state.state)} ${esc(state.attributes.unit_of_measurement || '')}</td>
        <td>${esc(state.attributes.account_kind)}</td></tr>`
			)
			.join('');
		const scheduleRows = schedules
			.map(({ entryId, schedule }) => {
				const name = schedule.payee || schedule.memo || 'scheduled payment';
				const actionStatus = schedule.status === 'paused' ? 'active' : 'paused';
				const scheduleKey = `schedule:${entryId}:${schedule.bookId}:${schedule.id}`;

				return `
        <li><span><strong>${esc(name)}</strong>
          <small>${esc(schedule.endDate || schedule.startDate)} · ${esc(schedule.status)}</small></span>
          <span class="actions">
            <button type="button" data-status="${actionStatus}" data-entry="${esc(entryId)}" data-book="${esc(schedule.bookId)}" data-schedule="${esc(schedule.id)}" aria-label="${actionStatus === 'active' ? 'Resume' : 'Pause'} ${esc(name)}" ${this._busy.has(scheduleKey) ? 'disabled aria-busy="true"' : ''}>${actionStatus === 'active' ? 'Resume' : 'Pause'}</button>
            <button type="button" data-status="canceled" data-entry="${esc(entryId)}" data-book="${esc(schedule.bookId)}" data-schedule="${esc(schedule.id)}" aria-label="Cancel ${esc(name)}" ${this._busy.has(scheduleKey) ? 'disabled aria-busy="true"' : ''}>Cancel</button>
          </span></li>`;
			})
			.join('');
		this.shadowRoot.innerHTML = `
      <ha-card header="Fin Assist">
        <div class="content">
          ${
				accounts.length === 0
					? `<p role="status">${states.some(state => state.attributes.integration_entry_id) ? 'No account balances are available.' : 'Fin Assist is not connected or its sensors are unavailable.'}</p>`
					: `
          <table><caption class="visually-hidden">Fin Assist account balances</caption>
            <thead><tr><th scope="col">Account</th><th scope="col">Balance</th><th scope="col">Type</th></tr></thead>
            <tbody>${accountRows}</tbody></table>`
			}
          <section aria-labelledby="upcoming-title"><h3 id="upcoming-title">Schedules ending soon</h3>
            ${schedules.length > 0 ? `<ul>${scheduleRows}</ul>` : `<p>${upcoming.length > 0 ? 'No active finite schedules end in the next 30 days.' : 'Schedule data is unavailable.'}</p>`}
            ${schedulesMayBeStale ? '<p role="status">Schedule data may be out of date.</p>' : ''}
          </section>
          <button class="refresh" type="button" ${this._busy.has('refresh') ? 'disabled aria-busy="true"' : ''}>${this._busy.has('refresh') ? 'Refreshing…' : 'Refresh'}</button>
          <p class="feedback${this._feedbackIsError ? ' error' : ''}" role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${esc(this._errorMessage)}</p>
        </div>
      </ha-card>
      <style>
        :host { display: block; }
        .content { padding: 16px; color: var(--primary-text-color); }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th, td { padding: 9px 6px; border-bottom: 1px solid var(--divider-color); }
        td { text-align: right; }
        caption.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        section { margin-top: 16px; }
        h3 { font-size: 1rem; }
        ul { list-style: none; margin: 0; padding: 0; }
        li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--divider-color); }
        small { display: block; color: var(--secondary-text-color); margin-top: 4px; }
        .actions { display: flex; flex-wrap: wrap; gap: 6px; }
        button { font: inherit; color: var(--primary-color); background: transparent; border: 1px solid var(--divider-color); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
        button:hover { background: var(--secondary-background-color); }
        button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .refresh { margin-top: 14px; }
        .feedback { min-height: 1.25em; margin: 8px 0 0; }
        .feedback.error { color: var(--error-color); }
        @media (max-width: 480px) { li { align-items: flex-start; flex-direction: column; } }
      </style>`;
		this.shadowRoot.querySelectorAll('button[data-status]').forEach(button => {
			button.addEventListener('click', () => {
				const status = button.dataset.status;
				const key = `schedule:${button.dataset.entry}:${button.dataset.book}:${button.dataset.schedule}`;
				this._runAction(
					key,
					() =>
						this._hass.callService('ha_finassists', 'set_schedule_status', {
							book_id: button.dataset.book,
							entry_id: button.dataset.entry,
							schedule_id: button.dataset.schedule,
							status,
						}),
					'Updating schedule…',
					'The schedule was updated.',
					'The schedule could not be updated. Check the integration connection and try again.'
				);
			});
		});
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
		description: 'Account balances and upcoming scheduled payments',
		name: 'Fin Assist',
		type: 'fin-assist-card',
	});
}
