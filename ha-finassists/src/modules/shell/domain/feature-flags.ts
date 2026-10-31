interface CapabilityFeatureFlags {
	categories: boolean;
	scheduledTransactions: boolean;
}

interface UiFeatureFlags {
	administration: boolean;
	monthSummary: boolean;
	monthSummaryChart: boolean;
	scheduledPending: boolean;
	scheduledSummary: boolean;
}

interface FeatureFlags {
	capabilities: CapabilityFeatureFlags;
	ui: UiFeatureFlags;
}

const DEFAULT_CAPABILITY_FEATURE_FLAGS: CapabilityFeatureFlags = {
	categories: true,
	scheduledTransactions: true,
};

const DEFAULT_UI_FEATURE_FLAGS: UiFeatureFlags = {
	administration: true,
	monthSummary: true,
	monthSummaryChart: true,
	scheduledPending: true,
	scheduledSummary: true,
};

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
	capabilities: DEFAULT_CAPABILITY_FEATURE_FLAGS,
	ui: DEFAULT_UI_FEATURE_FLAGS,
};

export {
	type CapabilityFeatureFlags,
	DEFAULT_CAPABILITY_FEATURE_FLAGS,
	DEFAULT_FEATURE_FLAGS,
	DEFAULT_UI_FEATURE_FLAGS,
	type FeatureFlags,
	type UiFeatureFlags,
};
