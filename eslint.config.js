import { fixupPluginRules } from '@eslint/compat';
import hexadrop from '@hexadrop/eslint-config';

const config = await hexadrop(
	{
		ignores: ['.impeccable/**', 'custom_components/**', 'hacs.json'],
		/*
		 * React lives in the app workspace, so enable its rules here instead of
		 * relying on detection from the repository root.
		 */
		react: true,
	},
	{
		rules: {
			'import/prefer-default-export': 'off',
		},
	},
	{
		/*
		 * Typed linting resolves the project from the repository root, so point it
		 * at both configs: the app package owns its own, and the root one covers
		 * the release tooling.
		 */
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.json', './ha-finassists/tsconfig.json'],
			},
		},
	},
	{
		files: ['ha-finassists/src/app/**/*.tsx'],
		settings: {
			react: { version: '19.3.1' },
		},
	},
	{
		/*
		 * `null` is the wire and storage representation of an absent reference
		 * (`actorId`, `categoryId`): JSON cannot carry `undefined` and SQLite uses
		 * NULL. Tests and object mothers mirror those payloads, and the HTTP and
		 * SQL boundaries translate them, so the rule is scoped off there instead
		 * of repeating a disable comment on every value.
		 */
		files: [
			'**/*.test.ts',
			'**/*.test.tsx',
			'**/*.mother.ts',
			'ha-finassists/src/modules/api/**/*.ts',
			'ha-finassists/src/modules/ledger/infrastructure/**/*.ts',
		],
		rules: { 'unicorn/no-null': 'off' },
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
