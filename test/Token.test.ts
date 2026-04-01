import { describe, expect, test } from '@effect/vitest';

import * as Token from '../src/Token.ts';
import { Testing } from '../src/index.ts';

const { Builders } = Testing;

// ---------------------------------------------------------------------------
// Type predicates
// ---------------------------------------------------------------------------

describe('Token.isKeyword', () => {
	test('returns true for matching keyword', () => {
		const t = Builders.token('Keyword', 'const');
		expect(Token.isKeyword(t, 'const')).toBe(true);
	});

	test('returns false for wrong keyword value', () => {
		const t = Builders.token('Keyword', 'const');
		expect(Token.isKeyword(t, 'let')).toBe(false);
	});

	test('returns false for non-keyword token', () => {
		const t = Builders.token('Identifier', 'const');
		expect(Token.isKeyword(t, 'const')).toBe(false);
	});
});

describe('Token.isPunctuator', () => {
	test('returns true for matching punctuator', () => {
		const t = Builders.token('Punctuator', '{');
		expect(Token.isPunctuator(t, '{')).toBe(true);
	});

	test('returns false for wrong value', () => {
		const t = Builders.token('Punctuator', '{');
		expect(Token.isPunctuator(t, '}')).toBe(false);
	});

	test('returns false for non-punctuator', () => {
		const t = Builders.token('Identifier', '{');
		expect(Token.isPunctuator(t, '{')).toBe(false);
	});
});

describe('Token.isIdentifier', () => {
	test('returns true for identifier token', () => {
		const t = Builders.token('Identifier', 'foo');
		expect(Token.isIdentifier(t)).toBe(true);
	});

	test('returns false for non-identifier', () => {
		const t = Builders.token('Keyword', 'const');
		expect(Token.isIdentifier(t)).toBe(false);
	});
});

describe('Token.isString', () => {
	test('returns true for string token', () => {
		const t = Builders.token('String', '"hello"');
		expect(Token.isString(t)).toBe(true);
	});
});

describe('Token.isNumeric', () => {
	test('returns true for numeric token', () => {
		const t = Builders.token('Numeric', '42');
		expect(Token.isNumeric(t)).toBe(true);
	});
});

describe('Token.isBoolean', () => {
	test('returns true for boolean token', () => {
		const t = Builders.token('Boolean', 'true');
		expect(Token.isBoolean(t)).toBe(true);
	});
});

describe('Token.isNull', () => {
	test('returns true for null token', () => {
		const t = Builders.token('Null', 'null');
		expect(Token.isNull(t)).toBe(true);
	});
});

describe('Token.isTemplate', () => {
	test('returns true for template token', () => {
		const t = Builders.token('Template', '`hello`');
		expect(Token.isTemplate(t)).toBe(true);
	});
});

describe('Token.isRegularExpression', () => {
	test('returns true for regex token', () => {
		const t = Builders.token('RegularExpression', '/abc/');
		expect(Token.isRegularExpression(t)).toBe(true);
	});
});

describe('Token.isPrivateIdentifier', () => {
	test('returns true for private identifier token', () => {
		const t = Builders.token('PrivateIdentifier', '#foo');
		expect(Token.isPrivateIdentifier(t)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

describe('Token.value', () => {
	test('returns the token value', () => {
		const t = Builders.token('Identifier', 'myVar');
		expect(Token.value(t)).toBe('myVar');
	});
});

describe('Token.type', () => {
	test('returns the token type', () => {
		const t = Builders.token('Keyword', 'const');
		expect(Token.type(t)).toBe('Keyword');
	});
});
