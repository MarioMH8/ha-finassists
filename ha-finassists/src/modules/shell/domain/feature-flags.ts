interface UiFeatureFlags {
	administration: boolean;
	monthSummary: boolean;
	monthSummaryChart: boolean;
	scheduledPending: boolean;
	scheduledSummary: boolean;
}

interface FeatureFlags {
	ui: UiFeatureFlags;
}

const DEFAULT_UI_FEATURE_FLAGS: UiFeatureFlags = {
	administration: true,
	monthSummary: true,
	monthSummaryChart: true,
	scheduledPending: true,
	scheduledSummary: true,
};

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
	ui: DEFAULT_UI_FEATURE_FLAGS,
};

export { DEFAULT_FEATURE_FLAGS, DEFAULT_UI_FEATURE_FLAGS, type FeatureFlags, type UiFeatureFlags };
