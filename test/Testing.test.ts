import { describe, expect, it, test } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import * as Testing from '../src/Testing.ts';
import * as Rule from '../src/Rule.ts';
import { RuleContext } from '../src/RuleContext.ts';
import { make as makeDiagnostic } from '../src/Diagnostic.ts';

// ---------------------------------------------------------------------------
// createMockContext
// ---------------------------------------------------------------------------

describe('Testing.createMockContext', () => {
	test('creates a context with default values', () => {
		const { context, diagnostics } = Testing.createMockContext();
		expect(context.id).toBe('effect/test-rule');
		expect(context.filename).toBe('/test/file.ts');
		expect(diagnostics).toHaveLength(0);
	});

	test('accepts custom filename', () => {
		const { context } = Testing.createMockContext({
			filename: '/custom/path.ts'
		});
		expect(context.filename).toBe('/custom/path.ts');
	});

	test('collects diagnostics on report', () => {
		const { context, diagnostics } = Testing.createMockContext();
		context.report({ node: { range: [0, 5] }, message: 'test' } as never);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]?.diagnostic.message).toBe('test');
	});
});

// ---------------------------------------------------------------------------
// mockRuleContextLayer / withMockRuleContext
// ---------------------------------------------------------------------------

describe('Testing.mockRuleContextLayer', () => {
	it.effect('provides RuleContext to an effect', () =>
		Effect.gen(function* () {
			const ctx = yield* RuleContext;
			expect(ctx.id).toBe('effect/test-rule');
		}).pipe(Effect.provide(Testing.mockRuleContextLayer()))
	);

	it.effect('supports custom options', () =>
		Effect.gen(function* () {
			const ctx = yield* RuleContext;
			expect(ctx.filename).toBe('/custom.ts');
		}).pipe(
			Effect.provide(
				Testing.mockRuleContextLayer({ filename: '/custom.ts' })
			)
		)
	);
});

describe('Testing.withMockRuleContext', () => {
	it.effect('provides RuleContext inline', () =>
		Testing.withMockRuleContext(
			Effect.gen(function* () {
				const ctx = yield* RuleContext;
				expect(ctx.filename).toBe('/test/file.ts');
			})
		)
	);
});

// ---------------------------------------------------------------------------
// runRule / runRuleMulti
// ---------------------------------------------------------------------------

describe('Testing.runRule', () => {
	test('runs a rule and collects diagnostics', () => {
		const rule = Rule.banStatement('ThrowStatement', {
			message: 'No throw'
		});
		const result = Testing.runRule(
			rule,
			'ThrowStatement',
			Testing.throwStmt()
		);
		expect(result).toHaveLength(1);
		expect(result[0]?.diagnostic.message).toBe('No throw');
	});

	test('returns empty when no diagnostic reported', () => {
		const rule = Rule.banStatement('ThrowStatement', {
			message: 'No throw'
		});
		// Fire a different visitor — should not trigger
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('foo')
		);
		expect(result).toHaveLength(0);
	});
});

describe('Testing.runRuleMulti', () => {
	test('runs multiple events in sequence', () => {
		const rule = Rule.banStatement('ThrowStatement', {
			message: 'No throw'
		});
		const result = Testing.runRuleMulti(rule, [
			['ThrowStatement', Testing.throwStmt()],
			['ThrowStatement', Testing.throwStmt()]
		]);
		expect(result).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

describe('Testing.expectDiagnostics', () => {
	test('passes when diagnostics match', () => {
		const result = [
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'A'
				})
			},
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'B'
				})
			}
		];
		// Should not throw
		Testing.expectDiagnostics(result, [{ message: 'A' }, { message: 'B' }]);
	});

	test('throws when count mismatches', () => {
		const result = [
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'A'
				})
			}
		];
		expect(() =>
			Testing.expectDiagnostics(result, [
				{ message: 'A' },
				{ message: 'B' }
			])
		).toThrow('Expected 2 diagnostics, got 1');
	});

	test('throws when message mismatches', () => {
		const result = [
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'Wrong'
				})
			}
		];
		expect(() =>
			Testing.expectDiagnostics(result, [{ message: 'Expected' }])
		).toThrow('expected message "Expected", got "Wrong"');
	});
});

describe('Testing.expectNoDiagnostics', () => {
	test('passes with empty results', () => {
		Testing.expectNoDiagnostics([]);
	});

	test('throws when diagnostics exist', () => {
		const result = [
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'Oops'
				})
			}
		];
		expect(() => Testing.expectNoDiagnostics(result)).toThrow(
			'Expected no diagnostics, got 1'
		);
	});
});

// ---------------------------------------------------------------------------
// Testing.newExpr — string auto-wrapping
// ---------------------------------------------------------------------------

describe('Testing.newExpr', () => {
	test('accepts a string callee and wraps it in id()', () => {
		const node = Testing.newExpr('Date');
		expect(node.type).toBe('NewExpression');
		expect(node.callee.type).toBe('Identifier');
		expect('name' in node.callee && node.callee.name).toBe('Date');
	});

	test('accepts a non-string callee unchanged', () => {
		const callee = Testing.id('Map');
		const node = Testing.newExpr(callee);
		expect(node.type).toBe('NewExpression');
		expect(node.callee.type).toBe('Identifier');
		expect('name' in node.callee && node.callee.name).toBe('Map');
	});

	test('passes arguments through', () => {
		const node = Testing.newExpr('Date', [Testing.numLiteral(0)]);
		expect(node.arguments).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Testing.ifStmt — optional parameters
// ---------------------------------------------------------------------------

describe('Testing.ifStmt', () => {
	test('creates minimal IfStatement with no args', () => {
		const node = Testing.ifStmt();
		expect(node.type).toBe('IfStatement');
	});

	test('accepts test and consequent', () => {
		const node = Testing.ifStmt(
			Testing.boolLiteral(true),
			Testing.blockStmt()
		);
		expect(node.type).toBe('IfStatement');
	});
});

// ---------------------------------------------------------------------------
// Testing.messages / Testing.messageIds
// ---------------------------------------------------------------------------

describe('Testing.messages', () => {
	test('extracts message strings from diagnostics', () => {
		const result = [
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'A'
				})
			},
			{
				diagnostic: makeDiagnostic({
					node: { range: [0, 5] } as never,
					message: 'B'
				})
			}
		];
		expect(Testing.messages(result)).toEqual([
			Option.some('A'),
			Option.some('B')
		]);
	});

	test('returns empty array for no diagnostics', () => {
		expect(Testing.messages([])).toEqual([]);
	});
});

describe('Testing.messageIds', () => {
	test('extracts messageId strings from diagnostics', () => {
		const result = [
			{
				diagnostic: {
					node: { range: [0, 5] },
					messageId: 'noThrow'
				} as never
			}
		];
		expect(Testing.messageIds(result)).toEqual([Option.some('noThrow')]);
	});
});
