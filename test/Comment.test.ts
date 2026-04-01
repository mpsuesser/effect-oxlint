import { describe, expect, test } from '@effect/vitest';

import * as Comment from '../src/Comment.ts';
import { Testing } from '../src/index.ts';

// ---------------------------------------------------------------------------
// Type predicates
// ---------------------------------------------------------------------------

describe('Comment.isLine', () => {
	test('returns true for line comment', () => {
		const c = Testing.comment('Line', ' some comment');
		expect(Comment.isLine(c)).toBe(true);
	});

	test('returns false for block comment', () => {
		const c = Testing.comment('Block', ' block comment ');
		expect(Comment.isLine(c)).toBe(false);
	});
});

describe('Comment.isBlock', () => {
	test('returns true for block comment', () => {
		const c = Testing.comment('Block', ' block ');
		expect(Comment.isBlock(c)).toBe(true);
	});

	test('returns false for line comment', () => {
		const c = Testing.comment('Line', ' line ');
		expect(Comment.isBlock(c)).toBe(false);
	});
});

describe('Comment.isShebang', () => {
	test('returns true for shebang comment', () => {
		const c = Testing.comment('Shebang', '!/usr/bin/env node');
		expect(Comment.isShebang(c)).toBe(true);
	});

	test('returns false for line comment', () => {
		const c = Testing.comment('Line', '!/usr/bin/env node');
		expect(Comment.isShebang(c)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

describe('Comment.text', () => {
	test('returns comment value', () => {
		const c = Testing.comment('Line', ' hello world');
		expect(Comment.text(c)).toBe(' hello world');
	});
});

describe('Comment.isJSDoc', () => {
	test('returns true for JSDoc block comment', () => {
		const c = Testing.comment('Block', '* @param x The value ');
		expect(Comment.isJSDoc(c)).toBe(true);
	});

	test('returns false for regular block comment', () => {
		const c = Testing.comment('Block', ' just a comment ');
		expect(Comment.isJSDoc(c)).toBe(false);
	});

	test('returns false for line comment starting with *', () => {
		const c = Testing.comment('Line', '* not jsdoc');
		expect(Comment.isJSDoc(c)).toBe(false);
	});
});

describe('Comment.isDisableDirective', () => {
	test('detects eslint-disable directive', () => {
		const c = Testing.comment('Line', ' eslint-disable-next-line no-throw');
		expect(Comment.isDisableDirective(c)).toBe(true);
	});

	test('detects oxlint-disable directive', () => {
		const c = Testing.comment('Block', ' oxlint-disable no-throw ');
		expect(Comment.isDisableDirective(c)).toBe(true);
	});

	test('returns false for regular comment', () => {
		const c = Testing.comment('Line', ' TODO: fix this');
		expect(Comment.isDisableDirective(c)).toBe(false);
	});
});

describe('Comment.isEnableDirective', () => {
	test('detects eslint-enable directive', () => {
		const c = Testing.comment('Line', ' eslint-enable no-throw');
		expect(Comment.isEnableDirective(c)).toBe(true);
	});

	test('detects oxlint-enable directive', () => {
		const c = Testing.comment('Block', ' oxlint-enable ');
		expect(Comment.isEnableDirective(c)).toBe(true);
	});

	test('returns false for disable directive', () => {
		const c = Testing.comment('Line', ' eslint-disable no-throw');
		expect(Comment.isEnableDirective(c)).toBe(false);
	});
});
