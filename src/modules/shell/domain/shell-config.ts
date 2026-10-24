interface ShellConfig {
	applicationName: string;
	currencyCode: string;
}

const DEFAULT_SHELL_CONFIG: ShellConfig = {
	applicationName: 'Fin Assist',
	currencyCode: 'EUR',
};

export { DEFAULT_SHELL_CONFIG, type ShellConfig };
