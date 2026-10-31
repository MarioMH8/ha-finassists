import type { FeatureFlags } from './feature-flags';
import { DEFAULT_FEATURE_FLAGS } from './feature-flags';

interface ShellConfig {
	applicationName: string;
	currencyCode: string;
	features: FeatureFlags;
}

const DEFAULT_SHELL_CONFIG: ShellConfig = {
	applicationName: 'Fin Assist',
	currencyCode: 'EUR',
	features: DEFAULT_FEATURE_FLAGS,
};

export { DEFAULT_SHELL_CONFIG, type ShellConfig };
