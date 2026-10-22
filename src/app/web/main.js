const translations = {
	en: {
		activeTokens: 'Active tokens',
		cancel: 'Cancel',
		checking: 'Checking service status…',
		confirmRevoke: 'Revoke token',
		copyFailed: 'Could not copy automatically. Select and copy the token manually.',
		copyToken: 'Copy token',
		createToken: 'Create token',
		creatingToken: 'Creating token…',
		description: 'Create personal API tokens to connect trusted tools to your Fin Assist account.',
		error: 'The service could not be reached',
		errorCreatingToken: 'Could not create a token. Please try again.',
		errorLoadingTokens: 'Could not load tokens. Check your connection and try again.',
		errorRevokingToken: 'Could not revoke this token. Please try again.',
		footer: 'Private by design. Runs on your Home Assistant instance.',
		issuedTokenTitle: 'Copy your new token',
		issuedTokenWarning: 'This secret is shown only once. Copy it now and store it safely.',
		loadingTokens: 'Loading tokens…',
		noTokens: 'No active tokens yet. Create one to connect an app or service.',
		ready: 'Service is running',
		refresh: 'Refresh',
		revoke: 'Revoke',
		revokedToken: 'Token revoked.',
		tokenCount: count => `${count} ${count === 1 ? 'token' : 'tokens'}`,
		tokenNameHint: 'Choose a name that helps you recognize where you use it.',
		tokenNameLabel: 'Token name',
		tokenNameRequired: 'Enter a name for this token.',
		tokenNameTooLong: 'Token names can be up to 80 characters.',
		tokensDescription: 'Tokens act as your account when connecting apps and services.',
		tokensTitle: 'Personal API tokens',
		welcome: 'Connect your tools securely',
	},
	es: {
		activeTokens: 'Tokens activos',
		cancel: 'Cancelar',
		checking: 'Comprobando el estado del servicio…',
		confirmRevoke: 'Revocar token',
		copyFailed: 'No se pudo copiar automáticamente. Selecciona y copia el token manualmente.',
		copyToken: 'Copiar token',
		createToken: 'Crear token',
		creatingToken: 'Creando token…',
		description: 'Crea tokens de API personales para conectar aplicaciones de confianza con Fin Assist.',
		error: 'No se pudo conectar con el servicio',
		errorCreatingToken: 'No se pudo crear el token. Inténtalo de nuevo.',
		errorLoadingTokens: 'No se pudieron cargar los tokens. Comprueba la conexión e inténtalo de nuevo.',
		errorRevokingToken: 'No se pudo revocar este token. Inténtalo de nuevo.',
		footer: 'Privado por diseño. Se ejecuta en tu instancia de Home Assistant.',
		issuedTokenTitle: 'Copia tu nuevo token',
		issuedTokenWarning: 'Este secreto solo se muestra una vez. Cópialo ahora y guárdalo de forma segura.',
		loadingTokens: 'Cargando tokens…',
		noTokens: 'Todavía no hay tokens activos. Crea uno para conectar una aplicación o servicio.',
		ready: 'El servicio está en funcionamiento',
		refresh: 'Actualizar',
		revoke: 'Revocar',
		revokedToken: 'Token revocado.',
		tokenCount: count => `${count} ${count === 1 ? 'token' : 'tokens'}`,
		tokenNameHint: 'Elige un nombre que te ayude a recordar dónde lo utilizas.',
		tokenNameLabel: 'Nombre del token',
		tokenNameRequired: 'Escribe un nombre para este token.',
		tokenNameTooLong: 'El nombre del token puede tener hasta 80 caracteres.',
		tokensDescription: 'Los tokens actúan como tu cuenta al conectar aplicaciones y servicios.',
		tokensTitle: 'Tokens de API personales',
		welcome: 'Conecta tus herramientas de forma segura',
	},
};

const language = navigator.languages.some(locale => locale.toLowerCase().startsWith('es')) ? 'es' : 'en';
const copy = translations[language];
document.documentElement.lang = language;

for (const element of document.querySelectorAll('[data-i18n]')) {
	const key = element.dataset.i18n;
	if (key && Object.hasOwn(copy, key) && typeof copy[key] === 'string') {
		element.textContent = copy[key];
	}
}

for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
	const key = element.dataset.i18nAriaLabel;
	if (key && Object.hasOwn(copy, key) && typeof copy[key] === 'string') {
		element.setAttribute('aria-label', copy[key]);
	}
}

const serviceStatus = document.querySelector('[data-status]');
const statusContainer = serviceStatus?.closest('.service-status');
const tokenForm = document.querySelector('[data-token-form]');
const tokenNameInput = document.querySelector('#token-name');
const tokenFeedback = document.querySelector('[data-token-feedback]');
const tokenList = document.querySelector('[data-token-list]');
const tokenListState = document.querySelector('[data-token-list-state]');
const tokenCount = document.querySelector('[data-token-count]');
const issuedToken = document.querySelector('[data-issued-token]');
const issuedSecret = document.querySelector('[data-issued-secret]');
const createButton = tokenForm?.querySelector('[type="submit"]');
const tokenState = { generation: 0, tokens: [] };

function setFeedback(message, state = '') {
	if (!tokenFeedback) {
		return;
	}

	tokenFeedback.textContent = message;
	tokenFeedback.dataset.state = state;
}

function tokenDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}

function renderTokens() {
	if (!tokenList || !tokenListState || !tokenCount) {
		return;
	}

	tokenList.replaceChildren();
	tokenCount.textContent = copy.tokenCount(tokenState.tokens.length);
	tokenListState.hidden = tokenState.tokens.length > 0;
	tokenListState.textContent = copy.noTokens;

	for (const token of tokenState.tokens) {
		const item = document.createElement('li');
		item.className = 'token-item';

		const details = document.createElement('div');
		details.className = 'token-details';
		const name = document.createElement('strong');
		name.textContent = token.name;
		const metadata = document.createElement('span');
		metadata.textContent = `${token.prefix} · ${tokenDate(token.createdAt)}`;
		details.append(name, metadata);

		const actions = document.createElement('div');
		actions.className = 'token-actions';
		const revokeButton = document.createElement('button');
		revokeButton.className = 'button button-danger';
		revokeButton.type = 'button';
		revokeButton.textContent = copy.revoke;
		revokeButton.addEventListener('click', () => confirmRevocation(token, revokeButton));
		actions.append(revokeButton);
		item.append(details, actions);
		tokenList.append(item);
	}
}

async function loadTokens() {
	if (!tokenListState) {
		return;
	}

	const generation = ++tokenState.generation;
	tokenListState.hidden = false;
	tokenListState.textContent = copy.loadingTokens;
	if (tokenList) {
		tokenList.replaceChildren();
	}

	try {
		const response = await fetch('./api/v1/tokens', { headers: { Accept: 'application/json' } });
		if (!response.ok) {
			throw new Error('Token list request failed');
		}
		const listedTokens = await response.json();
		if (generation !== tokenState.generation) {
			return;
		}
		tokenState.tokens = listedTokens;
		renderTokens();
	} catch {
		if (generation !== tokenState.generation) {
			return;
		}
		const latestListState = document.querySelector('[data-token-list-state]');
		if (latestListState) {
			latestListState.hidden = false;
			latestListState.textContent = copy.errorLoadingTokens;
		}
	}
}

function confirmRevocation(token, initialButton) {
	if (initialButton.dataset.confirming === 'true') {
		return;
	}

	initialButton.dataset.confirming = 'true';
	initialButton.hidden = true;
	const confirmButton = document.createElement('button');
	confirmButton.className = 'button button-danger button-danger-confirm';
	confirmButton.type = 'button';
	confirmButton.textContent = copy.confirmRevoke;
	confirmButton.setAttribute('aria-label', `${copy.confirmRevoke}: ${token.name}`);
	const cancelButton = document.createElement('button');
	cancelButton.className = 'button button-secondary';
	cancelButton.type = 'button';
	cancelButton.textContent = copy.cancel;

	const resetConfirmation = () => {
		initialButton.dataset.confirming = 'false';
		initialButton.hidden = false;
		initialButton.disabled = false;
		confirmButton.remove();
		cancelButton.remove();
		initialButton.focus();
	};

	cancelButton.addEventListener('click', resetConfirmation);
	confirmButton.addEventListener('click', async () => {
		confirmButton.disabled = true;
		cancelButton.disabled = true;
		try {
			const response = await fetch(`./api/v1/tokens/${encodeURIComponent(token.id)}`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error('Token revocation failed');
			}
			const revokedIndex = tokenState.tokens.findIndex(existing => existing.id === token.id);
			tokenState.generation += 1;
			tokenState.tokens = tokenState.tokens.filter(existing => existing.id !== token.id);
			setFeedback(copy.revokedToken, 'success');
			renderTokens();
			const remainingRevokeButtons = tokenList?.querySelectorAll(':scope > .token-item .button-danger');
			const focusTarget = remainingRevokeButtons?.[Math.min(revokedIndex, remainingRevokeButtons.length - 1)];
			(focusTarget ?? document.querySelector('[data-token-list-heading]'))?.focus();
		} catch {
			setFeedback(copy.errorRevokingToken, 'error');
			resetConfirmation();
		}
	});
	initialButton.after(confirmButton, cancelButton);
	confirmButton.focus();
}

try {
	const response = await fetch('./health', { headers: { Accept: 'application/json' } });
	if (!response.ok) {
		throw new Error('Unhealthy response');
	}
	if (serviceStatus) {
		serviceStatus.textContent = copy.ready;
	}
	statusContainer?.setAttribute('data-state', 'ready');
} catch {
	if (serviceStatus) {
		serviceStatus.textContent = copy.error;
	}
	statusContainer?.setAttribute('data-state', 'error');
}

await loadTokens();

tokenForm?.addEventListener('submit', async event => {
	event.preventDefault();
	if (!createButton || !(tokenNameInput instanceof HTMLInputElement)) {
		return;
	}

	const name = tokenNameInput.value.trim();
	if (!name) {
		setFeedback(copy.tokenNameRequired, 'error');
		tokenNameInput.focus();

		return;
	}
	if (name.length > 80) {
		setFeedback(copy.tokenNameTooLong, 'error');
		tokenNameInput.focus();

		return;
	}

	createButton.disabled = true;
	createButton.textContent = copy.creatingToken;
	setFeedback('');
	if (issuedToken && issuedSecret) {
		issuedSecret.textContent = '';
		issuedToken.hidden = true;
	}

	try {
		const response = await fetch('./api/v1/tokens', {
			body: JSON.stringify({ name }),
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			method: 'POST',
		});
		if (!response.ok) {
			throw new Error('Token creation failed');
		}
		const createdToken = await response.json();
		tokenState.generation += 1;
		tokenState.tokens = [createdToken, ...tokenState.tokens];
		renderTokens();
		const currentIssuedToken = document.querySelector('[data-issued-token]');
		const currentIssuedSecret = document.querySelector('[data-issued-secret]');
		if (currentIssuedToken && currentIssuedSecret) {
			currentIssuedSecret.textContent = createdToken.secret;
			currentIssuedToken.hidden = false;
			currentIssuedToken.focus();
		}
		const currentNameInput = document.querySelector('#token-name');
		if (currentNameInput instanceof HTMLInputElement) {
			currentNameInput.value = '';
		}
		setFeedback('');
	} catch {
		setFeedback(copy.errorCreatingToken, 'error');
	} finally {
		const currentCreateButton = tokenForm?.querySelector('[type="submit"]');
		if (currentCreateButton instanceof HTMLButtonElement) {
			currentCreateButton.disabled = false;
			currentCreateButton.textContent = copy.createToken;
		}
	}
});

document.querySelector('[data-refresh-tokens]')?.addEventListener('click', loadTokens);
document.querySelector('[data-copy-token]')?.addEventListener('click', async () => {
	const secret = issuedSecret?.textContent;
	if (!secret) {
		return;
	}

	try {
		await navigator.clipboard.writeText(secret);
		setFeedback(language === 'es' ? 'Token copiado.' : 'Token copied.', 'success');
	} catch {
		setFeedback(copy.copyFailed, 'error');
	}
});
