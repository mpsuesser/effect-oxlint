import { describe, expect, test } from '@effect/vitest';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';

import * as Rule from '../src/Rule.ts';
import { Testing } from '../src/index.ts';

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
		expect(Testing.messages(result)).toEqual(['Use Effect HTTP client']);
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
		expect(Testing.messages(result)).toEqual(['Use Clock service']);
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
});
