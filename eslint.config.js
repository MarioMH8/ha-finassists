import hexadrop from '@hexadrop/eslint-config';

export default hexadrop(
	{ ignores: ['.impeccable/**'] },
	{
		rules: {
			'import/prefer-default-export': 'off',
		},
	},
	{
		files: ['src/app/server.ts'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['src/app/http/security-headers.ts'],
		rules: {
			'style/quotes': 'off',
		},
	}
);
