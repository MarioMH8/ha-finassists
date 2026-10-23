interface AppShellSettings {
	applicationName: string;
	showLogo: boolean;
	showNavigation: boolean;
}

const DEFAULT_APP_SHELL_SETTINGS: AppShellSettings = {
	applicationName: 'Fin Assist',
	showLogo: true,
	showNavigation: true,
};

export { type AppShellSettings, DEFAULT_APP_SHELL_SETTINGS };
