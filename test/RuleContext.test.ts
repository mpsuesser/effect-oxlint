import { describe, expect, it } from '@effect/vitest';
import * as Effect from 'effect/Effect';

import {
	RuleContext,
	ast,
	cwd,
	filename,
	id,
	report,
	sourceCode,
	text
} from '../src/RuleContext.ts';
import { make as makeDiagnostic } from '../src/Diagnostic.ts';
import { Testing } from '../src/index.ts';

const TestLayer = Testing.mockRuleContextLayer({
	filename: '/project/src/app.ts',
	cwd: '/project',
	sourceText: 'const x = 1;'
});

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

describe('RuleContext.id', () => {
	it.effect('returns the rule ID', () =>
		Effect.gen(function* () {
			const result = yield* id;
			expect(result).toBe('effect/test-rule');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('RuleContext.filename', () => {
	it.effect('returns the filename from context', () =>
		Effect.gen(function* () {
			const result = yield* filename;
			expect(result).toBe('/project/src/app.ts');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('RuleContext.cwd', () => {
	it.effect('returns the working directory', () =>
		Effect.gen(function* () {
			const result = yield* cwd;
			expect(result).toBe('/project');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('RuleContext.sourceCode', () => {
	it.effect('returns the SourceCode object', () =>
		Effect.gen(function* () {
			const sc = yield* sourceCode;
			expect(sc).toBeDefined();
			expect(sc.text).toBe('const x = 1;');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('RuleContext.text', () => {
	it.effect('returns the raw source text', () =>
		Effect.gen(function* () {
			const result = yield* text;
			expect(result).toBe('const x = 1;');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('RuleContext.ast', () => {
	it.effect('returns the AST root program node', () =>
		Effect.gen(function* () {
			const result = yield* ast;
			expect(result.type).toBe('Program');
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

describe('RuleContext.report', () => {
	it.effect('reports a diagnostic through the service', () =>
		Effect.gen(function* () {
			const ctx = yield* Effect.service(RuleContext);
			const node = Testing.throwStmt();
			yield* ctx.report(
				makeDiagnostic({ node, message: 'test diagnostic' })
			);
		}).pipe(Effect.provide(TestLayer))
	);

	it.effect('report shorthand works without resolving full service', () =>
		Effect.gen(function* () {
			const node = Testing.throwStmt();
			// This should not throw — it exercises the report path
			yield* report(makeDiagnostic({ node, message: 'shorthand test' }));
		}).pipe(Effect.provide(TestLayer))
	);
});
