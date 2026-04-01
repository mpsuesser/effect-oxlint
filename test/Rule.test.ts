import { describe, expect, test } from '@effect/vitest';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';

import * as Rule from '../src/Rule.ts';
import { importDecl, memberExpr, runRule, throwStmt } from './_builders.ts';

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
		const diagnostics = runRule(rule, 'ThrowStatement', throwStmt());
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
		const diagnostics = runRule(rule, 'ThrowStatement', throwStmt());
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
		const diagnostics = runRule(
			rule,
			'MemberExpression',
			memberExpr('JSON', 'parse')
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
		const diagnostics = runRule(
			rule,
			'MemberExpression',
			memberExpr('JSON', 'stringify')
		);
		expect(Arr.length(diagnostics)).toBe(1);
	});

	test('does not report for non-matching object', () => {
		const rule = Rule.banMember('JSON', 'parse', {
			message: 'msg'
		});
		const diagnostics = runRule(
			rule,
			'MemberExpression',
			memberExpr('console', 'log')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('does not report for non-matching property', () => {
		const rule = Rule.banMember('JSON', 'parse', {
			message: 'msg'
		});
		const diagnostics = runRule(
			rule,
			'MemberExpression',
			memberExpr('JSON', 'stringify')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('works with single prop string', () => {
		const rule = Rule.banMember('Math', 'random', {
			message: 'Use Random service'
		});
		const diagnostics = runRule(
			rule,
			'MemberExpression',
			memberExpr('Math', 'random')
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
		const diagnostics = runRule(
			rule,
			'ImportDeclaration',
			importDecl('node:fs')
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
		const diagnostics = runRule(
			rule,
			'ImportDeclaration',
			importDecl('node:path')
		);
		expect(Arr.length(diagnostics)).toBe(1);
	});

	test('does not report for non-matching import', () => {
		const rule = Rule.banImport('node:fs', {
			message: 'msg'
		});
		const diagnostics = runRule(
			rule,
			'ImportDeclaration',
			importDecl('effect/Array')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});

	test('predicate does not report for non-matching', () => {
		const rule = Rule.banImport((src) => src.startsWith('node:'), {
			message: 'msg'
		});
		const diagnostics = runRule(
			rule,
			'ImportDeclaration',
			importDecl('effect')
		);
		expect(Arr.length(diagnostics)).toBe(0);
	});
});
