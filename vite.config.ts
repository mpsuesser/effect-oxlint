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
		plugins: ['typescript', 'import', 'unicorn', 'vitest'],
		jsPlugins: ['oxlint-effect'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-extra-non-null-assertion': 'error',
			'vitest/require-to-throw-message': 'off',

			// oxlint-effect rules
			'effect/avoid-try-catch': 'warn',
			'effect/throw-in-effect-gen': 'error',
			'effect/avoid-data-tagged-error': 'warn',
			'effect/avoid-direct-json': 'warn',
			'effect/avoid-option-getorthrow': 'warn',
			'effect/avoid-process-env': 'warn',
			'effect/use-random-service': 'warn',
			'effect/effect-run-in-body': 'warn',
			'effect/effect-promise-vs-trypromise': 'warn',
			'effect/prefer-schema-class': 'warn',
			'effect/use-console-service': 'warn',
			'effect/prefer-arr-sort': 'warn',
			'effect/avoid-node-imports': 'warn',
			'effect/use-filesystem-service': 'warn',
			'effect/use-path-service': 'warn',
			'effect/use-temp-file-scoped': 'warn',
			'effect/use-command-executor-service': 'warn',
			'effect/use-http-client-service': 'warn',
			'effect/avoid-platform-coupling': 'warn',
			'effect/prefer-match-over-switch': 'warn',
			'effect/imperative-loops': 'warn',
			'effect/avoid-untagged-errors': 'warn',
			'effect/avoid-any': 'warn',
			'effect/avoid-object-type': 'warn',
			'effect/avoid-ts-ignore': 'warn',
			'effect/avoid-mutable-state': 'warn',
			'effect/avoid-schema-suffix': 'warn',
			'effect/use-clock-service': 'warn',
			'effect/avoid-native-fetch': 'warn',
			'effect/avoid-react-hooks': 'warn',
			'effect/avoid-sync-fs': 'warn',
			'effect/stream-large-files': 'warn',
			'effect/context-tag-extends': 'warn',
			'effect/prefer-effect-fn': 'warn',
			'effect/yield-in-for-loop': 'warn',
			'effect/avoid-expect-in-if': 'warn',
			'effect/avoid-yield-ref': 'warn',
			'effect/effect-catchall-default': 'warn',
			'effect/avoid-direct-tag-checks': 'warn',
			'effect/vm-in-wrong-file': 'error',
			'effect/prefer-option-over-null': 'warn',
			'effect/casting-awareness': 'warn',
			'effect/prefer-namespace-imports': 'warn',
			'effect/prefer-effect-is': 'warn',
			'effect/avoid-native-object-helpers': 'warn',
			'effect/prefer-duration-constructors': 'warn',
			'effect/prefer-arr-match': 'warn',
			'effect/require-schema-type-alias': 'warn',
			'effect/require-filter-metadata': 'warn',
			'effect/no-barrel-imports': 'warn',
			'effect/no-opaque-instance-fields': 'error'
		},
		overrides: [
			{
				files: ['**/*.{test,spec}.*', 'src/Testing.ts'],
				rules: {
					'effect/avoid-untagged-errors': 'off',
					'effect/avoid-try-catch': 'off'
				}
			}
		],
		options: {
			typeAware: true,
			typeCheck: true
		}
	}
});
