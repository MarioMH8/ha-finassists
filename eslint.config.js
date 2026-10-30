import hexadrop from '@hexadrop/eslint-config';

export default await hexadrop(
	{
		ignores: ['custom_components/**/*.js'],
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
	},
	{
		/*
		 * Stateless server helpers live in static classes. The React bundle, tests
		 * and the process/composition entrypoints stay function-based, and the
		 * root tooling files are outside this scope.
		 *
		 * `Program > FunctionDeclaration` also catches `function foo() {}` paired
		 * with `export { foo }`, which an export-only selector would miss.
		 */
		files: ['ha-finassists/src/**/*.ts'],
		ignores: [
			'ha-finassists/src/app/**',
			'ha-finassists/src/**/*.test.ts',
			'ha-finassists/src/**/*.test.tsx',
			'ha-finassists/src/server.ts',
			'ha-finassists/src/app-bootstrap.ts',
			'ha-finassists/src/app-container.ts',
		],
		rules: {
			'no-restricted-syntax': [
				'error',
				// Kept from the shared preset: replacing the rule entry would drop them.
				'DebuggerStatement',
				'LabeledStatement',
				'WithStatement',
				'TSEnumDeclaration[const=true]',
				'TSExportAssignment',
				...[
					'Program > FunctionDeclaration',
					'Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
					'Program > VariableDeclaration > VariableDeclarator > FunctionExpression',
					'ExportNamedDeclaration > FunctionDeclaration',
					'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
					'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
					'ExportDefaultDeclaration > FunctionDeclaration',
					'ExportDefaultDeclaration > ArrowFunctionExpression',
					'ExportDefaultDeclaration > FunctionExpression',
				].map(selector => ({
					message: 'Prefer a class with static methods over an exported standalone function.',
					selector,
				})),
			],
		},
	}
);
