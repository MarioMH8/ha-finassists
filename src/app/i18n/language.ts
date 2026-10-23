const LANGUAGE = {
	ENGLISH: 'en',
	SPANISH: 'es',
} as const;

type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE];

export { LANGUAGE, type Language };
