import { describe, expect, test } from '@effect/vitest';
import * as Option from 'effect/Option';

import * as AST from '../src/AST.ts';
import {
	callExpr,
	callOfMember,
	computedMemberExpr,
	id,
	importDecl,
	memberExpr,
	objectExpr,
	objectExprLiteralKeys,
	objectExprWithSpread,
	strLiteral,
	withParentChain
} from './_builders.ts';

// ---------------------------------------------------------------------------
// matchMember
// ---------------------------------------------------------------------------

describe('matchMember', () => {
	test('matches obj.prop with a single prop string', () => {
		const node = memberExpr('JSON', 'parse');
		const result = AST.matchMember(node, 'JSON', 'parse');
		expect(Option.isSome(result)).toBe(true);
	});

	test('matches obj.prop with an array of prop strings', () => {
		const node = memberExpr('JSON', 'stringify');
		const result = AST.matchMember(node, 'JSON', ['parse', 'stringify']);
		expect(Option.isSome(result)).toBe(true);
	});

	test('returns None when object name does not match', () => {
		const node = memberExpr('console', 'log');
		const result = AST.matchMember(node, 'JSON', 'parse');
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None when property name does not match', () => {
		const node = memberExpr('JSON', 'log');
		const result = AST.matchMember(node, 'JSON', 'parse');
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None for computed member expressions', () => {
		const node = computedMemberExpr('JSON', 'parse');
		const result = AST.matchMember(node, 'JSON', 'parse');
		expect(Option.isNone(result)).toBe(true);
	});

	test('works in data-last (pipeable) form', () => {
		const node = memberExpr('Effect', 'gen');
		const matcher = AST.matchMember('Effect', 'gen');
		const result = matcher(node);
		expect(Option.isSome(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isMember
// ---------------------------------------------------------------------------

describe('isMember', () => {
	test('returns true for matching member', () => {
		const node = memberExpr('Effect', 'gen');
		expect(AST.isMember(node, 'Effect', 'gen')).toBe(true);
	});

	test('returns false for non-matching member', () => {
		const node = memberExpr('Effect', 'map');
		expect(AST.isMember(node, 'Effect', 'gen')).toBe(false);
	});

	test('works in data-last form', () => {
		const node = memberExpr('Effect', 'gen');
		const check = AST.isMember('Effect', 'gen');
		expect(check(node)).toBe(true);
	});

	test('accepts array of props', () => {
		const node = memberExpr('Effect', 'fnUntraced');
		expect(AST.isMember(node, 'Effect', ['fn', 'fnUntraced'])).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// matchCallOf
// ---------------------------------------------------------------------------

describe('matchCallOf', () => {
	test('matches call of obj.prop(...)', () => {
		const node = callOfMember('Effect', 'gen');
		const result = AST.matchCallOf(node, 'Effect', 'gen');
		expect(Option.isSome(result)).toBe(true);
	});

	test('matches call with array of prop names', () => {
		const node = callOfMember('Effect', 'fnUntraced');
		const result = AST.matchCallOf(node, 'Effect', ['fn', 'fnUntraced']);
		expect(Option.isSome(result)).toBe(true);
	});

	test('returns None for bare identifier callee', () => {
		const node = callExpr('fetch');
		const result = AST.matchCallOf(node, 'Effect', 'gen');
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None when object does not match', () => {
		const node = callOfMember('console', 'log');
		const result = AST.matchCallOf(node, 'Effect', 'gen');
		expect(Option.isNone(result)).toBe(true);
	});

	test('works in data-last form', () => {
		const node = callOfMember('Effect', 'gen');
		const matcher = AST.matchCallOf('Effect', 'gen');
		expect(Option.isSome(matcher(node))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isCallOf
// ---------------------------------------------------------------------------

describe('isCallOf', () => {
	test('returns true for matching call', () => {
		const node = callOfMember('Effect', 'gen');
		expect(AST.isCallOf(node, 'Effect', 'gen')).toBe(true);
	});

	test('returns false for non-matching call', () => {
		const node = callOfMember('console', 'log');
		expect(AST.isCallOf(node, 'Effect', 'gen')).toBe(false);
	});

	test('works in data-last form', () => {
		const check = AST.isCallOf('Effect', ['gen', 'fn']);
		expect(check(callOfMember('Effect', 'fn'))).toBe(true);
		expect(check(callOfMember('Effect', 'map'))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// matchImport / isImport
// ---------------------------------------------------------------------------

describe('matchImport', () => {
	test('matches exact source string', () => {
		const node = importDecl('node:fs');
		expect(Option.isSome(AST.matchImport(node, 'node:fs'))).toBe(true);
	});

	test('returns None for non-matching source', () => {
		const node = importDecl('effect');
		expect(Option.isNone(AST.matchImport(node, 'node:fs'))).toBe(true);
	});

	test('matches via predicate function', () => {
		const node = importDecl('node:path');
		const result = AST.matchImport(node, (src) => src.startsWith('node:'));
		expect(Option.isSome(result)).toBe(true);
	});

	test('predicate returns None when false', () => {
		const node = importDecl('effect/Array');
		const result = AST.matchImport(node, (src) => src.startsWith('node:'));
		expect(Option.isNone(result)).toBe(true);
	});

	test('works in data-last form', () => {
		const matcher = AST.matchImport('node:fs');
		expect(Option.isSome(matcher(importDecl('node:fs')))).toBe(true);
	});
});

describe('isImport', () => {
	test('returns true for matching import', () => {
		expect(AST.isImport(importDecl('node:fs'), 'node:fs')).toBe(true);
	});

	test('returns false for non-matching import', () => {
		expect(AST.isImport(importDecl('effect'), 'node:fs')).toBe(false);
	});

	test('works in data-last form', () => {
		const check = AST.isImport('node:fs');
		expect(check(importDecl('node:fs'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// calleeName
// ---------------------------------------------------------------------------

describe('calleeName', () => {
	test('extracts name from bare identifier callee', () => {
		const node = callExpr('fetch');
		expect(AST.calleeName(node)).toEqual(Option.some('fetch'));
	});

	test('returns None for member expression callee', () => {
		const node = callOfMember('Effect', 'gen');
		expect(Option.isNone(AST.calleeName(node))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// memberNames
// ---------------------------------------------------------------------------

describe('memberNames', () => {
	test('extracts object and property names', () => {
		const node = memberExpr('Effect', 'gen');
		expect(AST.memberNames(node)).toEqual(Option.some(['Effect', 'gen']));
	});

	test('returns None for computed expressions', () => {
		const node = computedMemberExpr('obj', 'prop');
		expect(Option.isNone(AST.memberNames(node))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// importSource
// ---------------------------------------------------------------------------

describe('importSource', () => {
	test('extracts the source string', () => {
		const node = importDecl('effect/Array');
		expect(AST.importSource(node)).toBe('effect/Array');
	});
});

// ---------------------------------------------------------------------------
// objectKeys / objectHasKey / objectGetValue
// ---------------------------------------------------------------------------

describe('objectKeys', () => {
	test('collects identifier keys', () => {
		const node = objectExpr([{ key: 'foo' }, { key: 'bar' }]);
		expect(AST.objectKeys(node)).toEqual(['foo', 'bar']);
	});

	test('collects string literal keys', () => {
		const node = objectExprLiteralKeys([
			{ key: 'hello' },
			{ key: 'world' }
		]);
		expect(AST.objectKeys(node)).toEqual(['hello', 'world']);
	});

	test('ignores spread elements', () => {
		const node = objectExprWithSpread(id('other'));
		expect(AST.objectKeys(node)).toEqual([]);
	});

	test('returns empty for empty object', () => {
		const node = objectExpr([]);
		expect(AST.objectKeys(node)).toEqual([]);
	});
});

describe('objectHasKey', () => {
	test('returns true when key exists', () => {
		const node = objectExpr([{ key: 'try' }, { key: 'catch' }]);
		expect(AST.objectHasKey(node, 'try')).toBe(true);
	});

	test('returns false when key is absent', () => {
		const node = objectExpr([{ key: 'try' }]);
		expect(AST.objectHasKey(node, 'catch')).toBe(false);
	});

	test('works in data-last form', () => {
		const node = objectExpr([{ key: 'decode' }]);
		const check = AST.objectHasKey('decode');
		expect(check(node)).toBe(true);
	});
});

describe('objectGetValue', () => {
	test('returns Some with value for identifier key', () => {
		const val = strLiteral('hello');
		const node = objectExpr([{ key: 'greeting', value: val }]);
		const result = AST.objectGetValue(node, 'greeting');
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.match(result, {
				onNone: () => null,
				onSome: (v) => v
			})
		).toBe(val);
	});

	test('returns Some with value for string literal key', () => {
		const val = strLiteral('world');
		const node = objectExprLiteralKeys([{ key: 'greeting', value: val }]);
		const result = AST.objectGetValue(node, 'greeting');
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.match(result, {
				onNone: () => null,
				onSome: (v) => v
			})
		).toBe(val);
	});

	test('returns None for missing key', () => {
		const node = objectExpr([{ key: 'foo' }]);
		expect(Option.isNone(AST.objectGetValue(node, 'bar'))).toBe(true);
	});

	test('works in data-last form', () => {
		const node = objectExpr([{ key: 'x' }]);
		const getter = AST.objectGetValue('x');
		expect(Option.isSome(getter(node))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// findAncestor / hasAncestor
// ---------------------------------------------------------------------------

describe('findAncestor', () => {
	test('finds ancestor with matching type', () => {
		// Chain: FunctionDeclaration → BlockStatement → ThrowStatement
		const node = withParentChain(
			'FunctionDeclaration',
			'BlockStatement',
			'ThrowStatement'
		);
		const result = AST.findAncestor(node, 'FunctionDeclaration');
		expect(Option.isSome(result)).toBe(true);
		expect(Option.map(result, (n) => n.type)).toEqual(
			Option.some('FunctionDeclaration')
		);
	});

	test('returns None when no ancestor matches', () => {
		const node = withParentChain('BlockStatement', 'ThrowStatement');
		const result = AST.findAncestor(node, 'ClassDeclaration');
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None for node with no parent', () => {
		const node = { type: 'Program', parent: undefined };
		expect(Option.isNone(AST.findAncestor(node, 'Anything'))).toBe(true);
	});
});

describe('hasAncestor', () => {
	test('returns true when ancestor exists', () => {
		const node = withParentChain('FunctionExpression', 'ReturnStatement');
		expect(AST.hasAncestor(node, 'FunctionExpression')).toBe(true);
	});

	test('returns false when ancestor does not exist', () => {
		const node = withParentChain('BlockStatement', 'ExpressionStatement');
		expect(AST.hasAncestor(node, 'ClassDeclaration')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// narrow (Phase 2)
// ---------------------------------------------------------------------------

describe('narrow', () => {
	test('returns Some when type matches', () => {
		const node = callExpr('foo');
		const result = AST.narrow(node, 'CallExpression');
		expect(Option.isSome(result)).toBe(true);
	});

	test('returns None when type does not match', () => {
		const node = callExpr('foo');
		const result = AST.narrow(node, 'MemberExpression');
		expect(Option.isNone(result)).toBe(true);
	});

	test('supports data-last (pipeable) form', () => {
		const node = importDecl('effect');
		const result = AST.narrow('ImportDeclaration')(node);
		expect(Option.isSome(result)).toBe(true);
	});

	test('returns None for wrong type in pipeable form', () => {
		const node = importDecl('effect');
		const result = AST.narrow('CallExpression')(node);
		expect(Option.isNone(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// memberPath (Phase 2)
// ---------------------------------------------------------------------------

describe('memberPath', () => {
	test('extracts two-segment path: Effect.gen', () => {
		const node = memberExpr('Effect', 'gen');
		const result = AST.memberPath(node);
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.getOrElse(result, () => [] as ReadonlyArray<string>)
		).toEqual(['Effect', 'gen']);
	});

	test('extracts three-segment path: a.b.c', () => {
		// Build a.b.c manually: MemberExpression(MemberExpression(a, b), c)
		const ab = memberExpr('a', 'b');
		const abc = {
			type: 'MemberExpression',
			object: ab,
			property: id('c'),
			computed: false,
			optional: false
		} as never;
		const result = AST.memberPath(abc);
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.getOrElse(result, () => [] as ReadonlyArray<string>)
		).toEqual(['a', 'b', 'c']);
	});

	test('returns None for computed member expression', () => {
		const node = computedMemberExpr('a', 'b');
		const result = AST.memberPath(node);
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None when inner segment is computed', () => {
		const inner = computedMemberExpr('a', 'b');
		const outer = {
			type: 'MemberExpression',
			object: inner,
			property: id('c'),
			computed: false,
			optional: false
		} as never;
		const result = AST.memberPath(outer);
		expect(Option.isNone(result)).toBe(true);
	});

	test('returns None when root is not an identifier', () => {
		// root is a Literal, not an Identifier
		const node = {
			type: 'MemberExpression',
			object: strLiteral('foo'),
			property: id('bar'),
			computed: false,
			optional: false
		} as never;
		const result = AST.memberPath(node);
		expect(Option.isNone(result)).toBe(true);
	});
});
