import type { ReactElement, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from './language';

const FEEDBACK_STATE = {
	EMPTY: '',
	ERROR: 'error',
	SUCCESS: 'success',
} as const;

type FeedbackState = (typeof FEEDBACK_STATE)[keyof typeof FEEDBACK_STATE];

const SERVICE_STATE = {
	CHECKING: 'checking',
	ERROR: 'error',
	READY: 'ready',
} as const;

type ServiceState = (typeof SERVICE_STATE)[keyof typeof SERVICE_STATE];

interface TokenMetadata {
	createdAt: string;
	id: string;
	name: string;
	prefix: string;
}

interface IssuedToken extends TokenMetadata {
	secret: string;
}

interface Copy {
	activeTokens: string;
	cancel: string;
	checking: string;
	confirmRevoke: string;
	copyFailed: string;
	copyToken: string;
	createToken: string;
	creatingToken: string;
	description: string;
	error: string;
	errorCreatingToken: string;
	errorLoadingTokens: string;
	errorRevokingToken: string;
	footer: string;
	issuedTokenTitle: string;
	issuedTokenWarning: string;
	loadingTokens: string;
	noTokens: string;
	ready: string;
	refresh: string;
	revoke: string;
	revokedToken: string;
	tokenCopied: string;
	tokenCount: (count: number) => string;
	tokenNameHint: string;
	tokenNameLabel: string;
	tokenNameRequired: string;
	tokenNameTooLong: string;
	tokensDescription: string;
	tokensTitle: string;
	welcome: string;
}

const translations: Record<Language, Copy> = {
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
		tokenCopied: 'Token copied.',
		tokenCount: count => `${String(count)} ${count === 1 ? 'token' : 'tokens'}`,
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
		tokenCopied: 'Token copiado.',
		tokenCount: count => `${String(count)} ${count === 1 ? 'token' : 'tokens'}`,
		tokenNameHint: 'Elige un nombre que te ayude a recordar dónde lo utilizas.',
		tokenNameLabel: 'Nombre del token',
		tokenNameRequired: 'Escribe un nombre para este token.',
		tokenNameTooLong: 'El nombre del token puede tener hasta 80 caracteres.',
		tokensDescription: 'Los tokens actúan como tu cuenta al conectar aplicaciones y servicios.',
		tokensTitle: 'Tokens de API personales',
		welcome: 'Conecta tus herramientas de forma segura',
	},
};

function formatTokenDate(value: string, language: Language): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}

function isIssuedToken(value: unknown): value is IssuedToken {
	return (
		typeof value === 'object' &&
		value !== null &&
		'createdAt' in value &&
		typeof value.createdAt === 'string' &&
		'id' in value &&
		typeof value.id === 'string' &&
		'name' in value &&
		typeof value.name === 'string' &&
		'prefix' in value &&
		typeof value.prefix === 'string' &&
		'secret' in value &&
		typeof value.secret === 'string'
	);
}

function isTokenList(value: unknown): value is TokenMetadata[] {
	return (
		Array.isArray(value) &&
		value.every(
			(token: unknown) =>
				typeof token === 'object' &&
				token !== null &&
				'createdAt' in token &&
				typeof token.createdAt === 'string' &&
				'id' in token &&
				typeof token.id === 'string' &&
				'name' in token &&
				typeof token.name === 'string' &&
				'prefix' in token &&
				typeof token.prefix === 'string'
		)
	);
}

interface Feedback {
	message: string;
	state: FeedbackState;
}

interface AppProps {
	language: Language;
}

function App({ language }: AppProps): ReactElement {
	const copy = translations[language];
	const [tokens, setTokens] = useState<TokenMetadata[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [listError, setListError] = useState(false);
	const [serviceState, setServiceState] = useState<ServiceState>(SERVICE_STATE.CHECKING);
	const [isCreating, setIsCreating] = useState(false);
	const [confirmingTokenId, setConfirmingTokenId] = useState<string | undefined>(undefined);
	const [issuedSecret, setIssuedSecret] = useState<string | undefined>(undefined);
	const [feedback, setFeedback] = useState<Feedback>({ message: '', state: FEEDBACK_STATE.EMPTY });
	const [focusAfterRemoval, setFocusAfterRemoval] = useState<number | undefined>(undefined);
	const [focusRevokeTokenId, setFocusRevokeTokenId] = useState<string | undefined>(undefined);
	const tokenNameReference = useRef<HTMLInputElement>(null);
	const tokenListReference = useRef<HTMLUListElement>(null);
	const tokenHeadingReference = useRef<HTMLHeadingElement>(null);
	const issuedTokenReference = useRef<HTMLElement>(null);
	const confirmationReference = useRef<HTMLButtonElement>(null);
	const loadGeneration = useRef(0);

	useEffect(() => {
		const controller = new AbortController();
		void checkService(controller.signal);
		void loadTokens(controller.signal);

		return () => controller.abort();
	}, []);

	useEffect(() => {
		if (confirmingTokenId) {
			confirmationReference.current?.focus();
		}
	}, [confirmingTokenId]);

	useEffect(() => {
		if (issuedSecret) {
			issuedTokenReference.current?.focus();
		}
	}, [issuedSecret]);

	useEffect(() => {
		if (focusAfterRemoval !== undefined) {
			const buttons = tokenListReference.current?.querySelectorAll<HTMLButtonElement>('.button-danger');
			const lastIndex = Math.max(0, (buttons?.length ?? 1) - 1);
			(buttons?.[Math.min(focusAfterRemoval, lastIndex)] ?? tokenHeadingReference.current)?.focus();
			setFocusAfterRemoval(undefined);
		}
		if (focusRevokeTokenId) {
			tokenListReference.current
				?.querySelector<HTMLButtonElement>(`[data-token-id="${CSS.escape(focusRevokeTokenId)}"]`)
				?.focus();
			setFocusRevokeTokenId(undefined);
		}
	}, [focusAfterRemoval, focusRevokeTokenId, tokens]);

	async function checkService(signal?: AbortSignal): Promise<void> {
		try {
			const response = await fetch('./health', { headers: { Accept: 'application/json' }, signal });
			if (!response.ok) {
				throw new Error('Unhealthy response');
			}
			setServiceState(SERVICE_STATE.READY);
		} catch {
			if (!signal?.aborted) {
				setServiceState(SERVICE_STATE.ERROR);
			}
		}
	}

	async function loadTokens(signal?: AbortSignal): Promise<void> {
		const generation = ++loadGeneration.current;
		setIsLoading(true);
		setListError(false);

		try {
			const response = await fetch('./api/v1/tokens', { headers: { Accept: 'application/json' }, signal });
			if (!response.ok) {
				throw new Error('Token list request failed');
			}
			const listedTokens: unknown = await response.json();
			if (!isTokenList(listedTokens)) {
				throw new Error('Token list response was invalid');
			}
			if (generation === loadGeneration.current) {
				setTokens(listedTokens);
			}
		} catch {
			if (generation === loadGeneration.current && !signal?.aborted) {
				setListError(true);
			}
		} finally {
			if (generation === loadGeneration.current && !signal?.aborted) {
				setIsLoading(false);
			}
		}
	}

	async function createToken(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		const name = tokenNameReference.current?.value.trim() ?? '';
		if (!name) {
			setFeedback({ message: copy.tokenNameRequired, state: FEEDBACK_STATE.ERROR });
			tokenNameReference.current?.focus();

			return;
		}
		if (name.length > 80) {
			setFeedback({ message: copy.tokenNameTooLong, state: FEEDBACK_STATE.ERROR });
			tokenNameReference.current?.focus();

			return;
		}

		setIsCreating(true);
		setFeedback({ message: '', state: '' });
		setIssuedSecret(undefined);
		try {
			const response = await fetch('./api/v1/tokens', {
				body: JSON.stringify({ name }),
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				method: 'POST',
			});
			if (!response.ok) {
				throw new Error('Token creation failed');
			}
			const value: unknown = await response.json();
			if (!isIssuedToken(value)) {
				throw new Error('Token response was invalid');
			}
			const { secret, ...metadata } = value;
			setTokens(current => [metadata, ...current]);
			setIssuedSecret(secret);
			setConfirmingTokenId(undefined);
			if (tokenNameReference.current) {
				tokenNameReference.current.value = '';
			}
		} catch {
			setFeedback({ message: copy.errorCreatingToken, state: FEEDBACK_STATE.ERROR });
		} finally {
			setIsCreating(false);
		}
	}

	async function revokeToken(token: TokenMetadata): Promise<void> {
		const index = tokens.findIndex(existing => existing.id === token.id);
		try {
			const response = await fetch(`./api/v1/tokens/${encodeURIComponent(token.id)}`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error('Token revocation failed');
			}
			loadGeneration.current += 1;
			setTokens(current => current.filter(existing => existing.id !== token.id));
			setConfirmingTokenId(undefined);
			setFeedback({ message: copy.revokedToken, state: FEEDBACK_STATE.SUCCESS });
			setFocusAfterRemoval(index);
		} catch {
			setConfirmingTokenId(undefined);
			setFocusRevokeTokenId(token.id);
			setFeedback({ message: copy.errorRevokingToken, state: FEEDBACK_STATE.ERROR });
		}
	}

	async function copyToken(): Promise<void> {
		if (!issuedSecret) {
			return;
		}

		try {
			await navigator.clipboard.writeText(issuedSecret);
			setFeedback({ message: copy.tokenCopied, state: FEEDBACK_STATE.SUCCESS });
		} catch {
			setFeedback({ message: copy.copyFailed, state: FEEDBACK_STATE.ERROR });
		}
	}

	const listState = isLoading
		? copy.loadingTokens
		: listError
			? copy.errorLoadingTokens
			: tokens.length === 0
				? copy.noTokens
				: '';
	const serviceMessage =
		serviceState === SERVICE_STATE.CHECKING
			? copy.checking
			: serviceState === SERVICE_STATE.READY
				? copy.ready
				: copy.error;

	return (
		<div className='app-shell'>
			<header className='app-header'>
				<div
					aria-hidden='true'
					className='brand-mark'>
					F
				</div>
				<h1>Fin Assist</h1>
			</header>
			<main
				className='main-content'
				id='main-content'
				tabIndex={-1}>
				<section
					aria-labelledby='welcome-title'
					className='welcome-card'>
					<h2 id='welcome-title'>{copy.welcome}</h2>
					<p>{copy.description}</p>
					<div
						aria-live='polite'
						className='service-status'
						data-state={serviceState === SERVICE_STATE.CHECKING ? undefined : serviceState}
						role='status'>
						<span
							aria-hidden='true'
							className='status-indicator'
						/>
						<span>{serviceMessage}</span>
					</div>
				</section>
				<section
					aria-labelledby='tokens-title'
					className='token-section'>
					<div className='section-heading'>
						<div>
							<h2 id='tokens-title'>{copy.tokensTitle}</h2>
							<p>{copy.tokensDescription}</p>
						</div>
						<button
							className='button button-secondary'
							onClick={() => void loadTokens()}
							type='button'>
							{copy.refresh}
						</button>
					</div>
					<form
						className='token-form'
						onSubmit={event => void createToken(event)}>
						<div className='form-field'>
							<label htmlFor='token-name'>{copy.tokenNameLabel}</label>
							<p
								className='field-hint'
								id='token-name-hint'>
								{copy.tokenNameHint}
							</p>
							<input
								aria-describedby='token-name-hint'
								autoComplete='off'
								id='token-name'
								maxLength={80}
								name='name'
								ref={tokenNameReference}
								required
								type='text'
							/>
						</div>
						<button
							aria-busy={isCreating}
							className='button button-primary'
							disabled={isCreating}
							type='submit'>
							{isCreating ? copy.creatingToken : copy.createToken}
						</button>
					</form>
					<p
						aria-atomic='true'
						aria-live='polite'
						className='token-feedback'
						data-state={feedback.state}
						role='status'>
						{feedback.message}
					</p>
					<section
						aria-labelledby='issued-token-title'
						className='issued-token'
						hidden={!issuedSecret}
						ref={issuedTokenReference}
						tabIndex={-1}>
						<h3 id='issued-token-title'>{copy.issuedTokenTitle}</h3>
						<p>{copy.issuedTokenWarning}</p>
						<div className='secret-field'>
							<code>{issuedSecret}</code>
							<button
								className='button button-secondary'
								onClick={() => void copyToken()}
								type='button'>
								{copy.copyToken}
							</button>
						</div>
					</section>
					<div className='token-list-heading'>
						<h3
							ref={tokenHeadingReference}
							tabIndex={-1}>
							{copy.activeTokens}
						</h3>
						<p>{copy.tokenCount(tokens.length)}</p>
					</div>
					<p
						className='token-list-state'
						hidden={!listState}>
						{listState}
					</p>
					<ul
						aria-label={copy.activeTokens}
						className='token-list'
						ref={tokenListReference}>
						{tokens.map(token => (
							<li
								className='token-item'
								key={token.id}>
								<div className='token-details'>
									<strong>{token.name}</strong>
									<span>
										{token.prefix} · {formatTokenDate(token.createdAt, language)}
									</span>
								</div>
								<div className='token-actions'>
									{confirmingTokenId === token.id ? (
										<>
											<button
												aria-label={`${copy.confirmRevoke}: ${token.name}`}
												className='button button-danger button-danger-confirm'
												onClick={() => void revokeToken(token)}
												ref={confirmationReference}
												type='button'>
												{copy.confirmRevoke}
											</button>
											<button
												className='button button-secondary'
												onClick={() => {
													setConfirmingTokenId(undefined);
													setFocusRevokeTokenId(token.id);
												}}
												type='button'>
												{copy.cancel}
											</button>
										</>
									) : (
										<button
											className='button button-danger'
											data-token-id={token.id}
											onClick={() => setConfirmingTokenId(token.id)}
											type='button'>
											{copy.revoke}
										</button>
									)}
								</div>
							</li>
						))}
					</ul>
				</section>
				<footer>{copy.footer}</footer>
			</main>
		</div>
	);
}

export { App };
