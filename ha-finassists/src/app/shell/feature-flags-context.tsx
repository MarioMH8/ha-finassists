import type { FeatureFlags } from '@modules/shell/domain';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_SHELL_CONFIG.features);

interface FeatureFlagsProviderProps {
	children: ReactNode;
	features: FeatureFlags;
}

function FeatureFlagsProvider({ children, features }: FeatureFlagsProviderProps): ReactElement {
	return <FeatureFlagsContext.Provider value={features}>{children}</FeatureFlagsContext.Provider>;
}

function useFeatureFlags(): FeatureFlags {
	return useContext(FeatureFlagsContext);
}

export { FeatureFlagsProvider, useFeatureFlags };
