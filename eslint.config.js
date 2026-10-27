import { fixupPluginRules } from '@eslint/compat';
import hexadrop from '@hexadrop/eslint-config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { createNodeResolver } from 'eslint-plugin-import-x';

// The root tsconfig is a solution file, so typed linting uses the concrete projects.
const typescriptProjects = ['./tsconfig.tools.json', './ha-finassists/tsconfig.json'];

const config = await hexadrop(
	{
		ignores: ['custom_components/**/*.js'],
		/*
		 * React lives in the app workspace, so enable its rules here instead of
		 * relying on detection from the repository root.
		 *
		 * `react-refresh/only-export-components` warns in this non-Vite app; the
		 * warnings are expected until hexadrop/eslint-config#1069 gates the rule
		 * on the bundler.
		 *
		 * TODO(hexadrop/eslint-config#1067): remove `react: true` once workspace
		 * auto-detection finds React in the app package.
		 */
		react: true,
		/*
		 * TODO(hexadrop/eslint-config#1068): let the package derive the concrete
		 * projects from the solution tsconfig once project references are
		 * supported end to end.
		 */
		typescript: typescriptProjects,
	},
	{
		rules: {
			'import/prefer-default-export': 'off',
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['../*', '../../*', '../../../*'],
							message: 'Import through @app/* or @modules/* instead of traversing parent directories.',
						},
					],
				},
			],
		},
	},
	{
		files: ['ha-finassists/src/**/*.ts', 'ha-finassists/src/**/*.tsx'],
		rules: {
			'typescript/no-empty-function': ['error', { allow: ['constructors'] }],
		},
	},
	{
		/*
		 * The version constant is the only app file that reaches outside src, and
		 * no alias points at the package manifest.
		 */
		files: ['ha-finassists/src/modules/version.ts'],
		rules: {
			'no-restricted-imports': 'off',
		},
	},
	{
		/*
		 * TODO(hexadrop/eslint-config#1065): remove this override once the package
		 * forwards the configured TypeScript project(s) to
		 * eslint-import-resolver-typescript.
		 * TODO(hexadrop/eslint-config#1068): the solution tsconfig can only be
		 * used here once project references are followed end to end.
		 */
		files: ['**/*.ts', '**/*.tsx'],
		settings: {
			'import-x/resolver-next': [
				createNodeResolver(),
				createTypeScriptImportResolver({ bun: true, project: ['./tsconfig.json'] }),
			],
		},
	},
	{
		/*
		 * Home Assistant requires snake_case directories and ships a legacy card
		 * bundle; JSON and Markdown still get linted.
		 */
		files: ['custom_components/**'],
		rules: { 'unicorn/filename-case': 'off' },
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
			'ha-finassists/src/modules/ledger/application/**/*.ts',
			'ha-finassists/src/modules/ledger/domain/scheduled-transaction.ts',
			'ha-finassists/src/modules/ledger/infrastructure/**/*.ts',
		],
		rules: { 'unicorn/no-null': 'off' },
	}
);

/*
 * TODO(hexadrop/eslint-config#1062): remove this wrapper (and @eslint/compat)
 * once the React preset works on ESLint 10 without a pinned version.
 */
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
