import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { useLocale } from '@app/i18n/locale-context';
import type { Dispatch, RefObject, SetStateAction, SubmitEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

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

interface Feedback {
	message: string;
	state: FeedbackState;
}

interface ApiTokenManagementState {
	cancelRevoke: (tokenId: string) => void;
	closeCreate: () => void;
	confirmingTokenId: string | undefined;
	copy: Copy;
	copyFeedback: Feedback;
	copyToken: () => Promise<void>;
	createToken: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
	feedback: Feedback;
	isCreateOpen: boolean;
	isCreating: boolean;
	isLoading: boolean;
	issuedSecret: string | undefined;
	issuedTokenReference: RefObject<HTMLDivElement | null>;
	listError: boolean;
	loadTokens: (signal?: AbortSignal) => Promise<void>;
	openCreate: () => void;
	revokeToken: (token: TokenMetadata) => Promise<void>;
	revokingTokenId: string | undefined;
	serviceMessage: string;
	serviceState: ServiceState;
	setConfirmingTokenId: Dispatch<SetStateAction<string | undefined>>;
	tokenCount: number;
	tokenHeadingReference: RefObject<HTMLHeadingElement | null>;
	tokenListReference: RefObject<HTMLUListElement | null>;
	tokenNameReference: RefObject<HTMLInputElement | null>;
	tokens: TokenMetadata[];
}

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

function useApiTokens(): ApiTokenManagementState {
	const { copy } = useLocale();
	const [tokens, setTokens] = useState<TokenMetadata[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [listError, setListError] = useState(false);
	const [serviceState, setServiceState] = useState<ServiceState>(SERVICE_STATE.CHECKING);
	const [isCreating, setIsCreating] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [confirmingTokenId, setConfirmingTokenId] = useState<string | undefined>(undefined);
	const [revokingTokenId, setRevokingTokenId] = useState<string | undefined>(undefined);
	const [issuedSecret, setIssuedSecret] = useState<string | undefined>(undefined);
	const [feedback, setFeedback] = useState<Feedback>({ message: '', state: FEEDBACK_STATE.EMPTY });
	const [copyFeedback, setCopyFeedback] = useState<Feedback>({ message: '', state: FEEDBACK_STATE.EMPTY });
	const [focusAfterRemoval, setFocusAfterRemoval] = useState<number | undefined>(undefined);
	const [focusRevokeTokenId, setFocusRevokeTokenId] = useState<string | undefined>(undefined);
	const tokenNameReference = useRef<HTMLInputElement>(null);
	const tokenListReference = useRef<HTMLUListElement>(null);
	const tokenHeadingReference = useRef<HTMLHeadingElement>(null);
	const issuedTokenReference = useRef<HTMLDivElement>(null);
	const loadGeneration = useRef(0);

	useEffect(() => {
		const controller = new AbortController();
		void checkService(controller.signal);
		void loadTokens(controller.signal);

		return () => controller.abort();
	}, []);

	useEffect(() => {
		if (issuedSecret) {
			issuedTokenReference.current?.focus();
		}
	}, [issuedSecret]);

	useEffect(() => {
		if (focusAfterRemoval !== undefined) {
			const triggers = tokenListReference.current?.querySelectorAll<HTMLButtonElement>('[aria-haspopup="menu"]');
			const lastIndex = Math.max(0, (triggers?.length ?? 1) - 1);
			(triggers?.[Math.min(focusAfterRemoval, lastIndex)] ?? tokenHeadingReference.current)?.focus();
			setFocusAfterRemoval(undefined);
		}
		if (focusRevokeTokenId) {
			tokenListReference.current
				?.querySelector<HTMLButtonElement>(
					`[data-token-id="${CSS.escape(focusRevokeTokenId)}"] [aria-haspopup="menu"]`
				)
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
		setFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
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
			setCopyFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
			setConfirmingTokenId(undefined);
			setFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
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
		setRevokingTokenId(token.id);
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
		} finally {
			setRevokingTokenId(undefined);
		}
	}

	function cancelRevoke(tokenId: string): void {
		setConfirmingTokenId(undefined);
		setFocusRevokeTokenId(tokenId);
	}

	function openCreate(): void {
		setIssuedSecret(undefined);
		setCopyFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
		setFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
		if (tokenNameReference.current) {
			tokenNameReference.current.value = '';
		}
		setIsCreateOpen(true);
	}

	function closeCreate(): void {
		setIsCreateOpen(false);
		setIssuedSecret(undefined);
		setCopyFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
		setFeedback({ message: '', state: FEEDBACK_STATE.EMPTY });
		if (tokenNameReference.current) {
			tokenNameReference.current.value = '';
		}
	}

	async function copyToken(): Promise<void> {
		if (!issuedSecret) {
			return;
		}

		try {
			await navigator.clipboard.writeText(issuedSecret);
			setCopyFeedback({ message: copy.tokenCopied, state: FEEDBACK_STATE.SUCCESS });
		} catch {
			setCopyFeedback({ message: copy.copyFailed, state: FEEDBACK_STATE.ERROR });
		}
	}

	const serviceMessage =
		serviceState === SERVICE_STATE.CHECKING
			? copy.checking
			: serviceState === SERVICE_STATE.READY
				? copy.ready
				: copy.error;

	return {
		cancelRevoke,
		closeCreate,
		confirmingTokenId,
		copy,
		copyFeedback,
		copyToken,
		createToken,
		feedback,
		isCreateOpen,
		isCreating,
		isLoading,
		issuedSecret,
		issuedTokenReference,
		listError,
		loadTokens,
		openCreate,
		revokeToken,
		revokingTokenId,
		serviceMessage,
		serviceState,
		setConfirmingTokenId,
		tokenCount: tokens.length,
		tokenHeadingReference,
		tokenListReference,
		tokenNameReference,
		tokens,
	};
}

export { type ApiTokenManagementState, formatTokenDate, useApiTokens };
