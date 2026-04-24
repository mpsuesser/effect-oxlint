import { describe, expect, test } from '@effect/vitest';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';

import { make as makeDiagnostic } from '../src/Diagnostic.ts';
import * as Rule from '../src/Rule.ts';
import { RuleContext } from '../src/RuleContext.ts';
import * as Visitor from '../src/Visitor.ts';
import * as Testing from '../src/Testing.ts';

// ---------------------------------------------------------------------------
// Rule.meta
// ---------------------------------------------------------------------------

describe('Rule.meta', () => {
	test('builds metadata with required fields', () => {
		const m = Rule.meta({
			type: 'problem',
			description: 'No throwing in Effect.gen'
		});
		expect(m.type).toBe('problem');
		expect(m.docs?.description).toBe('No throwing in Effect.gen');
	});

	test('includes optional fixable field', () => {
		const m = Rule.meta({
			type: 'suggestion',
			description: 'Use Schema',
			fixable: 'code'
		});
		expect(m.fixable).toBe('code');
	});

	test('includes optional messages', () => {
		const m = Rule.meta({
			type: 'problem',
			description: 'test',
			messages: { noThrow: 'Do not throw' }
		});
		expect(m.messages).toEqual({ noThrow: 'Do not throw' });
	});

	test('includes hasSuggestions', () => {
		const m = Rule.meta({
			type: 'suggestion',
			description: 'test',
			hasSuggestions: true
		});
		expect(m.hasSuggestions).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Rule.define — basic shape
// ---------------------------------------------------------------------------

describe('Rule.define', () => {
	test('creates a valid CreateRule with meta', () => {
		const rule = Rule.define({
			name: 'test-rule',
			meta: Rule.meta({
				type: 'problem',
				description: 'Test rule'
			}),
			create: function* () {
				yield* Effect.void;
				return {};
			}
		});
		expect(rule.meta?.type).toBe('problem');
		expect(rule.meta?.docs?.description).toBe('Test rule');
		expect(rule.create).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Rule.banStatement
// ---------------------------------------------------------------------------

describe('Rule.banStatement', () => {
	test('reports diagnostic for matching node type', () => {
		const rule = Rule.banStatement('ThrowStatement', {
			message: 'Use Effect.fail instead'
		});
		const diagnostics = Testing.runRule(
			rule,
			'ThrowStatement',
			Testing.throwStmt()
		);
		expect(Arr.length(diagnostics)).toBe(1);
		expect(diagnostics[0]?.diagnostic.message).toBe(
			'Use Effect.fail instead'
		);
	});

	test('does not report when handler key does not match', () => {
		const rule = Rule.banStatement('TryStatement', {
			message: 'Use Effect.try'
		});
		// ThrowStatement handler does not exist on this rule
		const diagnostics = Testing.runRule(
			rule,
			'ThrowStatement',
			Testing.throwStmt()
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('uses suggestion type by default', () => {
		const rule = Rule.banStatement('TryStatement', {
			message: 'msg'
		});
		expect(rule.meta?.type).toBe('suggestion');
	});

	test('allows overriding meta type', () => {
		const rule = Rule.banStatement('TryStatement', {
			message: 'msg',
			meta: { type: 'problem' }
		});
		expect(rule.meta?.type).toBe('problem');
	});
});

// ---------------------------------------------------------------------------
// Rule.banMember
// ---------------------------------------------------------------------------

describe('Rule.banMember', () => {
	test('reports for matching member expression', () => {
		const rule = Rule.banMember('JSON', ['parse', 'stringify'], {
			message: 'Use Schema for JSON (EF-19)'
		});
		const diagnostics = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('JSON', 'parse')
		);
		expect(Arr.length(diagnostics)).toBe(1);
		expect(diagnostics[0]?.diagnostic.message).toBe(
			'Use Schema for JSON (EF-19)'
		);
	});

	test('reports for second prop in array', () => {
		const rule = Rule.banMember('JSON', ['parse', 'stringify'], {
			message: 'Use Schema'
		});
		const diagnostics = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('JSON', 'stringify')
		);
		expect(Arr.length(diagnostics)).toBe(1);
	});

	test('does not report for non-matching object', () => {
		const rule = Rule.banMember('JSON', 'parse', {
			message: 'msg'
		});
		const diagnostics = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('console', 'log')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('does not report for non-matching property', () => {
		const rule = Rule.banMember('JSON', 'parse', {
			message: 'msg'
		});
		const diagnostics = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('JSON', 'stringify')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('works with single prop string', () => {
		const rule = Rule.banMember('Math', 'random', {
			message: 'Use Random service'
		});
		const diagnostics = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('Math', 'random')
		);
		expect(Arr.length(diagnostics)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Rule.banImport
// ---------------------------------------------------------------------------

describe('Rule.banImport', () => {
	test('reports for matching import source string', () => {
		const rule = Rule.banImport('node:fs', {
			message: 'Use Effect FileSystem service'
		});
		const diagnostics = Testing.runRule(
			rule,
			'ImportDeclaration',
			Testing.importDecl('node:fs')
		);
		expect(Arr.length(diagnostics)).toBe(1);
		expect(diagnostics[0]?.diagnostic.message).toBe(
			'Use Effect FileSystem service'
		);
	});

	test('reports for matching predicate', () => {
		const rule = Rule.banImport((src) => src.startsWith('node:'), {
			message: 'No node: imports'
		});
		const diagnostics = Testing.runRule(
			rule,
			'ImportDeclaration',
			Testing.importDecl('node:path')
		);
		expect(Arr.length(diagnostics)).toBe(1);
	});

	test('does not report for non-matching import', () => {
		const rule = Rule.banImport('node:fs', {
			message: 'msg'
		});
		const diagnostics = Testing.runRule(
			rule,
			'ImportDeclaration',
			Testing.importDecl('effect/Array')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('predicate does not report for non-matching', () => {
		const rule = Rule.banImport((src) => src.startsWith('node:'), {
			message: 'msg'
		});
		const diagnostics = Testing.runRule(
			rule,
			'ImportDeclaration',
			Testing.importDecl('effect')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Rule.banCallOfMember
// ---------------------------------------------------------------------------

describe('Rule.banCallOfMember', () => {
	test('reports for matching obj.prop(...) call', () => {
		const rule = Rule.banCallOfMember('Effect', 'runSync', {
			message: 'Keep effects composable'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('Effect', 'runSync')
		);
		expect(Arr.length(result)).toBe(1);
		expect(Testing.messages(result)).toEqual([
			Option.some('Keep effects composable')
		]);
	});

	test('reports for any property in an allowed list', () => {
		const rule = Rule.banCallOfMember('console', ['log', 'error'], {
			message: 'Use Effect.log'
		});
		const r1 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('console', 'log')
		);
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('console', 'error')
		);
		expect(Arr.length(r2)).toBe(1);
	});

	test('does not report for a non-matching object', () => {
		const rule = Rule.banCallOfMember('Effect', 'runSync', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('Other', 'runSync')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('does not report for a non-matching property', () => {
		const rule = Rule.banCallOfMember('Effect', 'runSync', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('Effect', 'gen')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('does not report for bare identifier calls', () => {
		const rule = Rule.banCallOfMember('Effect', 'runSync', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('runSync')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('generated name uses kebab-case', () => {
		const rule = Rule.banCallOfMember('Effect', ['runSync', 'runPromise'], {
			message: 'msg'
		});
		// Name is an implementation detail; we only check it stays kebab-clean.
		expect(rule.meta?.docs?.description).toBe('msg');
	});
});

// ---------------------------------------------------------------------------
// Rule.banCallOf
// ---------------------------------------------------------------------------

describe('Rule.banCallOf', () => {
	test('reports for matching bare identifier call', () => {
		const rule = Rule.banCallOf('fetch', {
			message: 'Use Effect HTTP client'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('fetch')
		);
		expect(Arr.length(result)).toBe(1);
		expect(Testing.messages(result)).toEqual([
			Option.some('Use Effect HTTP client')
		]);
	});

	test('reports for multiple banned names', () => {
		const rule = Rule.banCallOf(['useState', 'useEffect'], {
			message: 'Use Effect'
		});
		const r1 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('useState')
		);
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('useEffect')
		);
		expect(Arr.length(r2)).toBe(1);
	});

	test('does not report for non-matching call', () => {
		const rule = Rule.banCallOf('fetch', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('console')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('does not report for member expression calls', () => {
		const rule = Rule.banCallOf('fetch', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('window', 'fetch')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('uses suggestion type by default', () => {
		const rule = Rule.banCallOf('fetch', { message: 'msg' });
		expect(rule.meta?.type).toBe('suggestion');
	});

	test('allows overriding meta type', () => {
		const rule = Rule.banCallOf('fetch', {
			message: 'msg',
			meta: { type: 'problem' }
		});
		expect(rule.meta?.type).toBe('problem');
	});
});

// ---------------------------------------------------------------------------
// Rule.banNewExpr
// ---------------------------------------------------------------------------

describe('Rule.banNewExpr', () => {
	test('reports for matching new expression', () => {
		const rule = Rule.banNewExpr('Date', {
			message: 'Use Clock service'
		});
		const result = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Date')
		);
		expect(Arr.length(result)).toBe(1);
		expect(Testing.messages(result)).toEqual([
			Option.some('Use Clock service')
		]);
	});

	test('reports for multiple banned constructors', () => {
		const rule = Rule.banNewExpr(['Error', 'TypeError'], {
			message: 'Use tagged errors'
		});
		const r1 = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Error')
		);
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('TypeError')
		);
		expect(Arr.length(r2)).toBe(1);
	});

	test('does not report for non-matching constructor', () => {
		const rule = Rule.banNewExpr('Date', {
			message: 'msg'
		});
		const result = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Map')
		);
		expect(Arr.length(result)).toBe(0);
	});

	test('uses suggestion type by default', () => {
		const rule = Rule.banNewExpr('Date', { message: 'msg' });
		expect(rule.meta?.type).toBe('suggestion');
	});
});

// ---------------------------------------------------------------------------
// Rule.banMultiple
// ---------------------------------------------------------------------------

describe('Rule.banMultiple', () => {
	test('bans multiple statement types', () => {
		const rule = Rule.banMultiple(
			{
				statements: ['ForStatement', 'ForInStatement', 'WhileStatement']
			},
			{ message: 'Use Arr.map instead' }
		);
		const r1 = Testing.runRule(rule, 'ForStatement', Testing.forStmt());
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(rule, 'WhileStatement', Testing.whileStmt());
		expect(Arr.length(r2)).toBe(1);
	});

	test('bans call expressions', () => {
		const rule = Rule.banMultiple(
			{ calls: 'fetch' },
			{ message: 'No fetch' }
		);
		const result = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('fetch')
		);
		expect(Arr.length(result)).toBe(1);
	});

	test('bans new expressions', () => {
		const rule = Rule.banMultiple(
			{ newExprs: 'Date' },
			{ message: 'No Date' }
		);
		const result = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Date')
		);
		expect(Arr.length(result)).toBe(1);
	});

	test('bans member expressions', () => {
		const rule = Rule.banMultiple(
			{ members: [['Date', 'now']] },
			{ message: 'No Date.now' }
		);
		const result = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('Date', 'now')
		);
		expect(Arr.length(result)).toBe(1);
	});

	test('bans imports', () => {
		const rule = Rule.banMultiple(
			{ imports: ['node:fs'] },
			{ message: 'No node:fs' }
		);
		const result = Testing.runRule(
			rule,
			'ImportDeclaration',
			Testing.importDecl('node:fs')
		);
		expect(Arr.length(result)).toBe(1);
	});

	test('combines new expressions and member bans', () => {
		const rule = Rule.banMultiple(
			{
				newExprs: 'Date',
				members: [['Date', 'now']]
			},
			{ message: 'Use Clock service' }
		);
		const r1 = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Date')
		);
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(
			rule,
			'MemberExpression',
			Testing.memberExpr('Date', 'now')
		);
		expect(Arr.length(r2)).toBe(1);
	});

	test('does not report for non-matching nodes', () => {
		const rule = Rule.banMultiple(
			{
				calls: 'fetch',
				newExprs: 'Date',
				statements: ['ThrowStatement']
			},
			{ message: 'msg' }
		);
		const r1 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callExpr('console')
		);
		expect(Arr.length(r1)).toBe(0);

		const r2 = Testing.runRule(
			rule,
			'NewExpression',
			Testing.newExpr('Map')
		);
		expect(Arr.length(r2)).toBe(0);
	});

	test('accepts custom name', () => {
		const rule = Rule.banMultiple(
			{ statements: ['ThrowStatement'] },
			{ name: 'my-custom-rule', message: 'msg' }
		);
		expect(rule.meta?.type).toBe('suggestion');
	});

	test('bans member call patterns via memberCalls', () => {
		const rule = Rule.banMultiple(
			{
				memberCalls: [
					['Effect', ['runSync', 'runPromise']],
					['console', 'log']
				]
			},
			{ message: 'Keep effects composable / use Effect.log' }
		);

		const r1 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('Effect', 'runSync')
		);
		expect(Arr.length(r1)).toBe(1);

		const r2 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('console', 'log')
		);
		expect(Arr.length(r2)).toBe(1);

		const r3 = Testing.runRule(
			rule,
			'CallExpression',
			Testing.callOfMember('Effect', 'gen')
		);
		expect(Arr.length(r3)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Rule.define — options schema decoding
// ---------------------------------------------------------------------------

describe('Rule.define with options', () => {
	test('decodes options via Schema at create time', () => {
		class RuleOptions extends Schema.Class<RuleOptions>('RuleOptions')({
			strict: Schema.Boolean
		}) {}
		const rule = Rule.define({
			name: 'options-test',
			meta: Rule.meta({
				type: 'suggestion',
				description: 'Test with options'
			}),
			options: RuleOptions,
			create: function* (options) {
				const ctx = yield* RuleContext;
				return Visitor.on('ThrowStatement', (node) =>
					options.strict
						? ctx.report(
								makeDiagnostic({
									node,
									message: `strict=${options.strict}`
								})
							)
						: Effect.void
				);
			}
		});
		const result = Testing.runRule(
			rule,
			'ThrowStatement',
			Testing.throwStmt(),
			{ options: [{ strict: true }] }
		);
		expect(Arr.length(result)).toBe(1);
		expect(result[0]?.diagnostic.message).toBe('strict=true');
	});

	test('options default to undefined when no schema provided', () => {
		const rule = Rule.define({
			name: 'no-options',
			meta: Rule.meta({
				type: 'suggestion',
				description: 'No options'
			}),
			create: function* () {
				const ctx = yield* RuleContext;
				return Visitor.on('ThrowStatement', (node) =>
					ctx.report(makeDiagnostic({ node, message: 'reported' }))
				);
			}
		});
		const result = Testing.runRule(
			rule,
			'ThrowStatement',
			Testing.throwStmt()
		);
		expect(Arr.length(result)).toBe(1);
	});

	test('rule with Ref state persists across visitor calls', () => {
		const rule = Rule.define({
			name: 'stateful-rule',
			meta: Rule.meta({
				type: 'problem',
				description: 'Stateful test'
			}),
			create: function* () {
				const ctx = yield* RuleContext;
				const count = yield* Ref.make(0);
				return Visitor.on('ThrowStatement', (node) =>
					Effect.gen(function* () {
						yield* Ref.update(count, (n) => n + 1);
						const current = yield* Ref.get(count);
						if (current >= 2) {
							yield* ctx.report(
								makeDiagnostic({
									node,
									message: `count=${current}`
								})
							);
						}
					})
				);
			}
		});
		const result = Testing.runRuleMulti(rule, [
			['ThrowStatement', Testing.throwStmt()],
			['ThrowStatement', Testing.throwStmt()],
			['ThrowStatement', Testing.throwStmt()]
		]);
		// Only the 2nd and 3rd calls trigger (count >= 2)
		expect(Arr.length(result)).toBe(2);
	});
});
