interface ShellConfig {
	applicationName: string;
	currencyCode: string;
	showLogo: boolean;
	showNavigation: boolean;
}

const DEFAULT_SHELL_CONFIG: ShellConfig = {
	applicationName: 'Fin Assist',
	currencyCode: 'EUR',
	showLogo: true,
	showNavigation: true,
};

export { DEFAULT_SHELL_CONFIG, type ShellConfig };
