import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { Copy } from '.';
import { getCopy } from '.';
import type { Language } from './language';

interface LocaleContextValue {
	copy: Copy;
	language: Language;
}

interface LocaleProviderProps {
	children: ReactNode;
	language: Language;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function LocaleProvider({ children, language }: LocaleProviderProps): ReactElement {
	const value: LocaleContextValue = { copy: getCopy(language), language };

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocale(): LocaleContextValue {
	const locale = useContext(LocaleContext);
	if (locale === undefined) {
		throw new Error('useLocale must be used within LocaleProvider');
	}

	return locale;
}

export { LocaleProvider, useLocale };
