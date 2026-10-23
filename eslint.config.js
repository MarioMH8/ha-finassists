import { fixupPluginRules } from '@eslint/compat';
import hexadrop from '@hexadrop/eslint-config';

const config = await hexadrop(
	{ ignores: ['.impeccable/**', 'custom_components/**', 'hacs.json'] },
	{
		rules: {
			'import/prefer-default-export': 'off',
		},
	},
	{
		files: ['src/app/**/*.tsx'],
		settings: {
			react: { version: '19.3.1' },
		},
	}
);

export default config.map(item =>
	item.plugins?.react
		? {
				...item,
				plugins: {
					...item.plugins,
					react: fixupPluginRules(item.plugins.react),
				},
			}
		: item
);
