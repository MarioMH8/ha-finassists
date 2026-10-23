interface ShellConfig {
	applicationName: string;
	showLogo: boolean;
	showNavigation: boolean;
}

const DEFAULT_SHELL_CONFIG: ShellConfig = {
	applicationName: 'Fin Assist',
	showLogo: true,
	showNavigation: true,
};

export { DEFAULT_SHELL_CONFIG, type ShellConfig };
