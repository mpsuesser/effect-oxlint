import { describe, expect, it, test } from '@effect/vitest';
import * as Effect from 'effect/Effect';

import { Testing } from '../src/index.ts';
import * as Rule from '../src/Rule.ts';
import { RuleContext } from '../src/RuleContext.ts';
import { make as makeDiagnostic } from '../src/Diagnostic.ts';

const { Builders } = Testing;

// ---------------------------------------------------------------------------
// Builders — basic node construction
// ---------------------------------------------------------------------------

describe('Builders', () => {
	test('id creates an Identifier node', () => {
		const node = Builders.id('foo');
		expect(node.type).toBe('Identifier');
		expect(node.name).toBe('foo');
	});

	test('memberExpr creates a non-computed MemberExpression', () => {
		const node = Builders.memberExpr('a', 'b');
		expect(node.type).toBe('MemberExpression');
		expect(node.computed).toBe(false);
	});

	test('computedMemberExpr creates a computed MemberExpression', () => {
		const node = Builders.computedMemberExpr('a', 'b');
		expect(node.type).toBe('MemberExpression');
		expect(node.computed).toBe(true);
	});

	test('chainedMemberExpr creates a.b.c', () => {
		const node = Builders.chainedMemberExpr('a', 'b', 'c');
		expect(node.type).toBe('MemberExpression');
		// The outer property should be 'c'
		expect(node.computed).toBe(false);
		expect(node.property).toHaveProperty('name', 'c');
	});

	test('callExpr creates a bare call expression', () => {
		const node = Builders.callExpr('foo');
		expect(node.type).toBe('CallExpression');
	});

	test('callOfMember creates obj.prop(args)', () => {
		const node = Builders.callOfMember('Effect', 'gen');
		expect(node.type).toBe('CallExpression');
		expect(node.callee.type).toBe('MemberExpression');
	});

	test('importDecl creates an import declaration', () => {
		const node = Builders.importDecl('effect');
		expect(node.type).toBe('ImportDeclaration');
		expect(node.source.value).toBe('effect');
	});

	test('strLiteral creates a string literal', () => {
		const node = Builders.strLiteral('hello');
		expect(node.type).toBe('Literal');
		expect(node.value).toBe('hello');
	});

	test('numLiteral creates a numeric literal', () => {
		const node = Builders.numLiteral(42);
		expect(node.type).toBe('Literal');
		expect(node.value).toBe(42);
	});

	test('boolLiteral creates a boolean literal', () => {
		const node = Builders.boolLiteral(true);
		expect(node.type).toBe('Literal');
		expect(node.value).toBe(true);
	});

	test('throwStmt creates a ThrowStatement', () => {
		const node = Builders.throwStmt();
		expect(node.type).toBe('ThrowStatement');
	});

	test('tryStmt creates a TryStatement', () => {
		const node = Builders.tryStmt();
		expect(node.type).toBe('TryStatement');
	});

	test('returnStmt creates a ReturnStatement', () => {
		const node = Builders.returnStmt();
		expect(node.type).toBe('ReturnStatement');
	});

	test('blockStmt creates a BlockStatement', () => {
		const node = Builders.blockStmt();
		expect(node.type).toBe('BlockStatement');
	});

	test('arrowFn creates an ArrowFunctionExpression', () => {
		const node = Builders.arrowFn();
		expect(node.type).toBe('ArrowFunctionExpression');
	});

	test('varDecl creates a VariableDeclaration', () => {
		const node = Builders.varDecl('const', 'x');
		expect(node.type).toBe('VariableDeclaration');
		expect(node.kind).toBe('const');
	});

	test('exprStmt creates an ExpressionStatement', () => {
		const expr = Builders.id('foo');
		const node = Builders.exprStmt(expr);
		expect(node.type).toBe('ExpressionStatement');
	});

	test('program creates a Program node', () => {
		const node = Builders.program();
		expect(node.type).toBe('Program');
	});

	test('ifStmt creates an IfStatement', () => {
		const node = Builders.ifStmt(
			Builders.boolLiteral(true),
			Builders.blockStmt()
		);
		expect(node.type).toBe('IfStatement');
	});

	test('binaryExpr creates a BinaryExpression', () => {
		const node = Builders.binaryExpr(
			'===',
			Builders.id('a'),
			Builders.numLiteral(1)
		);
		expect(node.type).toBe('BinaryExpression');
	});

	test('newExpr creates a NewExpression', () => {
		const node = Builders.newExpr(Builders.id('Error'));
		expect(node.type).toBe('NewExpression');
	});

	test('objectExpr creates an ObjectExpression', () => {
		const node = Builders.objectExpr([{ key: 'a' }, { key: 'b' }]);
		expect(node.type).toBe('ObjectExpression');
		expect(node.properties).toHaveLength(2);
	});

	test('withParentChain creates linked parent chain', () => {
		const node = Builders.withParentChain(
			'FunctionDeclaration',
			'BlockStatement',
			'ThrowStatement'
		);
		expect(node.type).toBe('ThrowStatement');
		expect(node.parent).toBeDefined();
		expect(node.parent).toHaveProperty('type', 'BlockStatement');
	});

	test('token creates a mock Token', () => {
		const t = Builders.token('Keyword', 'const');
		expect(t.type).toBe('Keyword');
		expect(t.value).toBe('const');
	});

	test('comment creates a mock Comment', () => {
		const c = Builders.comment('Line', ' hello');
		expect(c.type).toBe('Line');
		expect(c.value).toBe(' hello');
	});

	test('scope creates a mock Scope', () => {
		const s = Builders.scope({ type: 'module', isStrict: true });
		expect(s.type).toBe('module');
		expect(s.isStrict).toBe(true);
	});

	test('variable creates a mock Variable', () => {
		const v = Builders.variable('myVar');
		expect(v.name).toBe('myVar');
		expect(v.references).toHaveLength(0);
	});
});

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
			Builders.throwStmt()
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
			Builders.callExpr('foo')
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
			['ThrowStatement', Builders.throwStmt()],
			['ThrowStatement', Builders.throwStmt()]
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
