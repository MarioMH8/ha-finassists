import type { CapabilityFeatureFlags, FeatureFlags, ShellConfig, UiFeatureFlags } from '@modules/shell/domain';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';

interface AttributeSource {
	getAttribute(name: string): null | string;
}

class ShellSettings {
	private static readonly CAPABILITY_ATTRIBUTES: Record<keyof CapabilityFeatureFlags, string> = {
		categories: 'data-capability-categories',
		scheduledTransactions: 'data-capability-scheduled-transactions',
	};

	private static readonly UI_FEATURE_ATTRIBUTES: Record<keyof UiFeatureFlags, string> = {
		administration: 'data-feature-administration',
		monthSummary: 'data-feature-month-summary',
		monthSummaryChart: 'data-feature-month-summary-chart',
		scheduledPending: 'data-feature-scheduled-pending',
		scheduledSummary: 'data-feature-scheduled-summary',
	};

	private constructor() {}

	static fromDocument(source: AttributeSource | null): ShellConfig {
		const isMonthSummaryEnabled = this.isFeatureEnabled(
			source,
			this.UI_FEATURE_ATTRIBUTES.monthSummary,
			DEFAULT_SHELL_CONFIG.features.ui.monthSummary
		);

		return {
			applicationName: source?.getAttribute('data-application-name') ?? DEFAULT_SHELL_CONFIG.applicationName,
			currencyCode: source?.getAttribute('data-currency-code') ?? DEFAULT_SHELL_CONFIG.currencyCode,
			features: {
				capabilities: {
					categories: this.isFeatureEnabled(
						source,
						this.CAPABILITY_ATTRIBUTES.categories,
						DEFAULT_SHELL_CONFIG.features.capabilities.categories
					),
					scheduledTransactions: this.isFeatureEnabled(
						source,
						this.CAPABILITY_ATTRIBUTES.scheduledTransactions,
						DEFAULT_SHELL_CONFIG.features.capabilities.scheduledTransactions
					),
				},
				ui: {
					administration: this.isFeatureEnabled(
						source,
						this.UI_FEATURE_ATTRIBUTES.administration,
						DEFAULT_SHELL_CONFIG.features.ui.administration
					),
					monthSummary: isMonthSummaryEnabled,
					monthSummaryChart:
						isMonthSummaryEnabled &&
						this.isFeatureEnabled(
							source,
							this.UI_FEATURE_ATTRIBUTES.monthSummaryChart,
							DEFAULT_SHELL_CONFIG.features.ui.monthSummaryChart
						),
					scheduledPending: this.isFeatureEnabled(
						source,
						this.UI_FEATURE_ATTRIBUTES.scheduledPending,
						DEFAULT_SHELL_CONFIG.features.ui.scheduledPending
					),
					scheduledSummary: this.isFeatureEnabled(
						source,
						this.UI_FEATURE_ATTRIBUTES.scheduledSummary,
						DEFAULT_SHELL_CONFIG.features.ui.scheduledSummary
					),
				},
			},
		};
	}

	static toFeatureAttributes(features: FeatureFlags): Record<string, string> {
		const attributes: Record<string, string> = {};
		for (const feature of Object.keys(this.CAPABILITY_ATTRIBUTES) as (keyof CapabilityFeatureFlags)[]) {
			attributes[this.CAPABILITY_ATTRIBUTES[feature]] = String(features.capabilities[feature]);
		}
		for (const feature of Object.keys(this.UI_FEATURE_ATTRIBUTES) as (keyof UiFeatureFlags)[]) {
			attributes[this.UI_FEATURE_ATTRIBUTES[feature]] = String(features.ui[feature]);
		}

		return attributes;
	}

	private static isFeatureEnabled(source: AttributeSource | null, name: string, isFallbackEnabled: boolean): boolean {
		const value = source?.getAttribute(name);
		if (value === 'true') {
			return true;
		}
		if (value === 'false') {
			return false;
		}

		return isFallbackEnabled;
	}
}

export { type AttributeSource, ShellSettings };
