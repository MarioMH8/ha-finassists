const translations = {
	en: {
		checking: 'Checking service status…',
		description:
			'The application scaffold is ready. Accounts, transactions, and the rest of your household-finance tools will be built here.',
		error: 'The service could not be reached',
		eyebrow: 'Home Assistant add-on',
		footer: 'Private by design. Runs on your Home Assistant instance.',
		ready: 'Service is running',
		title: 'Fin Assist',
		welcome: 'Your financial workspace starts here',
	},
	es: {
		checking: 'Comprobando el estado del servicio…',
		description:
			'La estructura inicial está lista. Aquí se desarrollarán las cuentas, transacciones y demás herramientas financieras del hogar.',
		error: 'No se pudo conectar con el servicio',
		eyebrow: 'Complemento de Home Assistant',
		footer: 'Privado por diseño. Se ejecuta en tu instancia de Home Assistant.',
		ready: 'El servicio está en funcionamiento',
		title: 'Fin Assist',
		welcome: 'Tu espacio financiero empieza aquí',
	},
};

const language = navigator.languages.some(locale => locale.toLowerCase().startsWith('es')) ? 'es' : 'en';
const copy = translations[language];
document.documentElement.lang = language;

for (const element of document.querySelectorAll('[data-i18n]')) {
	const key = element.dataset.i18n;
	if (key && Object.hasOwn(copy, key)) {
		element.textContent = copy[key];
	}
}

const serviceStatus = document.querySelector('[data-status]');
const statusContainer = serviceStatus?.closest('.service-status');

try {
	const response = await fetch('./health', { headers: { Accept: 'application/json' } });
	if (!response.ok) {
		throw new Error('Unhealthy response');
	}
	if (serviceStatus) {
		serviceStatus.textContent = copy.ready;
	}
	statusContainer?.setAttribute('data-state', 'ready');
} catch {
	if (serviceStatus) {
		serviceStatus.textContent = copy.error;
	}
	statusContainer?.setAttribute('data-state', 'error');
}
