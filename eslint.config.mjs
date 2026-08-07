import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: ['dist/**', 'node_modules/**', 'src/**/*.js', 'coverage/**'],
    },
    {
        files: ['src/**/*.ts'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
        rules: {
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },
    eslintConfigPrettier
);
