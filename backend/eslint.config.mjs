import pluginJs from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['.next/**', 'node_modules/**', '.env*', 'next-env.d.ts'] },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                },
            ],
            // console.error/warn is the codebase's logging convention; only flag the
            // debug/verbose variants.
            'no-console': ['warn', { allow: ['error', 'warn'] }],
        },
    },
    {
        files: ['test/**'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        // Standalone CommonJS scripts (migrations, tooling) legitimately use
        // require() — don't lint them as modules.
        files: ['scripts/**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    }
);
