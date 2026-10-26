import { fixupPluginRules } from '@eslint/compat';
import hexadrop from '@hexadrop/eslint-config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { createNodeResolver } from 'eslint-plugin-import-x';

const typescriptProjects = ['./tsconfig.json', './ha-finassists/tsconfig.json'];

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
		 * Each workspace owns a tsconfig and the root one only covers the release
		 * tooling, so typed linting and import resolution need both projects.
		 */
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parserOptions: {
				project: typescriptProjects,
			},
		},
		settings: {
			'import-x/resolver-next': [
				createNodeResolver(),
				createTypeScriptImportResolver({ bun: true, project: typescriptProjects }),
			],
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
