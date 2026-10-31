import type { FeatureFlags, ShellConfig, UiFeatureFlags } from '@modules/shell/domain';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';

const UI_FEATURE_ATTRIBUTES: Record<keyof UiFeatureFlags, string> = {
	administration: 'data-feature-administration',
	monthSummary: 'data-feature-month-summary',
	monthSummaryChart: 'data-feature-month-summary-chart',
	scheduledPending: 'data-feature-scheduled-pending',
	scheduledSummary: 'data-feature-scheduled-summary',
};

interface AttributeSource {
	getAttribute(name: string): null | string;
}

function isFeatureEnabled(source: AttributeSource | null, name: string, isFallbackEnabled: boolean): boolean {
	const value = source?.getAttribute(name);
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}

	return isFallbackEnabled;
}

function readShellSettings(source: AttributeSource | null): ShellConfig {
	const isMonthSummaryEnabled = isFeatureEnabled(
		source,
		UI_FEATURE_ATTRIBUTES.monthSummary,
		DEFAULT_SHELL_CONFIG.features.ui.monthSummary
	);

	return {
		applicationName: source?.getAttribute('data-application-name') ?? DEFAULT_SHELL_CONFIG.applicationName,
		currencyCode: source?.getAttribute('data-currency-code') ?? DEFAULT_SHELL_CONFIG.currencyCode,
		features: {
			ui: {
				administration: isFeatureEnabled(
					source,
					UI_FEATURE_ATTRIBUTES.administration,
					DEFAULT_SHELL_CONFIG.features.ui.administration
				),
				monthSummary: isMonthSummaryEnabled,
				monthSummaryChart:
					isMonthSummaryEnabled &&
					isFeatureEnabled(
						source,
						UI_FEATURE_ATTRIBUTES.monthSummaryChart,
						DEFAULT_SHELL_CONFIG.features.ui.monthSummaryChart
					),
				scheduledPending: isFeatureEnabled(
					source,
					UI_FEATURE_ATTRIBUTES.scheduledPending,
					DEFAULT_SHELL_CONFIG.features.ui.scheduledPending
				),
				scheduledSummary: isFeatureEnabled(
					source,
					UI_FEATURE_ATTRIBUTES.scheduledSummary,
					DEFAULT_SHELL_CONFIG.features.ui.scheduledSummary
				),
			},
		},
	};
}

function featureAttributes(features: FeatureFlags): Record<string, string> {
	return Object.fromEntries(
		(Object.keys(UI_FEATURE_ATTRIBUTES) as (keyof UiFeatureFlags)[]).map(feature => [
			UI_FEATURE_ATTRIBUTES[feature],
			String(features.ui[feature]),
		])
	);
}

export { type AttributeSource, featureAttributes, readShellSettings, UI_FEATURE_ATTRIBUTES };
