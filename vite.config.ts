import effect from '@enfect/oxlint';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	test: {
		setupFiles: [`${import.meta.dirname}/vitest.setup.ts`],
		include: ['test/**/*.test.ts'],
		passWithNoTests: true,
		globals: false,
		testTimeout: 30000,
		hookTimeout: 30000,
		pool: 'forks',
		isolate: false
	},
	fmt: {
		useTabs: true,
		tabWidth: 4,
		printWidth: 80,
		endOfLine: 'lf',
		singleQuote: true,
		arrowParens: 'always',
		bracketSpacing: true,
		quoteProps: 'preserve',
		semi: true,
		trailingComma: 'none',
		ignorePatterns: ['*.md'],
		overrides: [
			{
				files: ['*.json', '*.jsonc'],
				options: {
					useTabs: false,
					tabWidth: 2
				}
			}
		]
	},
	staged: {
		'*.{ts,tsx,js,jsx}': ['vp check --fix', 'vitest run']
	},
	lint: {
		extends: [effect.configs.recommended],
		plugins: ['typescript', 'import', 'unicorn', 'vitest'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-extra-non-null-assertion': 'error',
			'vitest/require-to-throw-message': 'off'
		},
		overrides: [
			{
				// The oxlint FFI boundary: these modules adapt oxlint's nullable,
				// mutable, synchronous plugin API to the Effect-first surface.
				files: [
					'src/Rule.ts',
					'src/SourceCode.ts',
					'src/Testing.ts',
					'src/Visitor.ts'
				],
				rules: {
					'effect/avoid-any': 'off',
					'effect/avoid-native-object-helpers': 'off',
					'effect/casting-awareness': 'off',
					'effect/effect-run-in-body': 'off',
					'effect/prefer-option-over-null': 'off'
				}
			},
			{
				// Mock builders accept arbitrary partial nodes, and assertion
				// helpers throw plain errors so test runners report them.
				files: ['src/Testing.ts'],
				rules: {
					'effect/avoid-untagged-errors': 'off',
					'effect/no-unknown-parameters': 'off'
				}
			},
			{
				files: ['**/*.{test,spec}.*'],
				rules: {
					'effect/avoid-try-catch': 'off',
					'effect/avoid-untagged-errors': 'off',
					'vitest/expect-expect': 'off',
					'vitest/no-standalone-expect': 'off'
				}
			}
		],
		options: {
			typeAware: true,
			typeCheck: true
		}
	}
});
