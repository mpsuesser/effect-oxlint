import type { Fix as OxlintFix, Fixer, Range, Ranged } from '@oxlint/plugins';
import { describe, expect, test } from '@effect/vitest';

import * as Diagnostic from '../src/Diagnostic.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal mock ranged node for fix operations. */
const rangedNode = (): Ranged => ({
	range: [0, 10] satisfies Range
});

/** Minimal mock fixer that records operations. */
const createMockFixer = () => {
	const ops: Array<{ readonly op: string; readonly text?: string }> = [];
	const makeFix = (range: Range, text: string): OxlintFix => ({
		range,
		text
	});
	const fixer: Fixer = {
		replaceText(_nodeOrToken, text) {
			ops.push({ op: 'replaceText', text });
			return makeFix([0, 10], text);
		},
		replaceTextRange(range, text) {
			ops.push({ op: 'replaceTextRange', text });
			return makeFix(range, text);
		},
		insertTextBefore(_nodeOrToken, text) {
			ops.push({ op: 'insertTextBefore', text });
			return makeFix([0, 0], text);
		},
		insertTextBeforeRange(range, text) {
			ops.push({ op: 'insertTextBeforeRange', text });
			return makeFix([range[0], range[0]], text);
		},
		insertTextAfter(_nodeOrToken, text) {
			ops.push({ op: 'insertTextAfter', text });
			return makeFix([10, 10], text);
		},
		insertTextAfterRange(range, text) {
			ops.push({ op: 'insertTextAfterRange', text });
			return makeFix([range[1], range[1]], text);
		},
		remove(_nodeOrToken) {
			ops.push({ op: 'remove' });
			return makeFix([0, 10], '');
		},
		removeRange(range) {
			ops.push({ op: 'removeRange' });
			return makeFix(range, '');
		}
	};
	return { fixer, ops };
};

// ---------------------------------------------------------------------------
// Diagnostic.make
// ---------------------------------------------------------------------------

describe('Diagnostic.make', () => {
	test('creates a diagnostic with message and node', () => {
		const node = rangedNode();
		const diag = Diagnostic.make({ node, message: 'Do not throw' });
		expect(diag.message).toBe('Do not throw');
		expect(diag.node).toBe(node);
	});

	test('includes data when provided', () => {
		const node = rangedNode();
		const diag = Diagnostic.make({
			node,
			message: '`{{name}}` is banned',
			data: { name: 'JSON.parse' }
		});
		expect(diag.data).toEqual({ name: 'JSON.parse' });
	});
});

// ---------------------------------------------------------------------------
// Diagnostic.fromId
// ---------------------------------------------------------------------------

describe('Diagnostic.fromId', () => {
	test('creates a diagnostic with messageId', () => {
		const node = rangedNode();
		const diag = Diagnostic.fromId({ node, messageId: 'noThrow' });
		expect(diag.messageId).toBe('noThrow');
		expect(diag.node).toBe(node);
	});

	test('includes data when provided', () => {
		const node = rangedNode();
		const diag = Diagnostic.fromId({
			node,
			messageId: 'banned',
			data: { name: 'fetch' }
		});
		expect(diag.data).toEqual({ name: 'fetch' });
	});
});

// ---------------------------------------------------------------------------
// Diagnostic.withFix
// ---------------------------------------------------------------------------

describe('Diagnostic.withFix', () => {
	test('attaches a fix function to a diagnostic', () => {
		const node = rangedNode();
		const diag = Diagnostic.make({ node, message: 'fix me' });
		const fixFn = Diagnostic.replaceText(node, 'fixed');
		const withFix = Diagnostic.withFix(diag, fixFn);
		expect(withFix.fix).toBeDefined();
		expect(withFix.message).toBe('fix me');
	});

	test('preserves existing diagnostic fields', () => {
		const node = rangedNode();
		const diag = Diagnostic.make({
			node,
			message: 'msg',
			data: { x: 'y' }
		});
		const withFix = Diagnostic.withFix(
			diag,
			Diagnostic.replaceText(node, 'z')
		);
		expect(withFix.data).toEqual({ x: 'y' });
		expect(withFix.node).toBe(node);
	});
});

// ---------------------------------------------------------------------------
// Diagnostic.withSuggestions
// ---------------------------------------------------------------------------

describe('Diagnostic.withSuggestions', () => {
	test('attaches suggestions to a diagnostic', () => {
		const node = rangedNode();
		const diag = Diagnostic.make({ node, message: 'suggest me' });
		const suggestions = [
			{
				desc: 'Use Schema.decodeUnknown',
				fix: Diagnostic.replaceText(node, 'Schema.decodeUnknown')
			}
		];
		const withSuggestions = Diagnostic.withSuggestions(diag, suggestions);
		expect(withSuggestions.suggest).toHaveLength(1);
		expect(withSuggestions.suggest?.[0]?.desc).toBe(
			'Use Schema.decodeUnknown'
		);
	});
});

// ---------------------------------------------------------------------------
// Fix helpers
// ---------------------------------------------------------------------------

describe('Fix helpers', () => {
	test('replaceText calls fixer.replaceText', () => {
		const node = rangedNode();
		const fixFn = Diagnostic.replaceText(node, 'newText');
		const { fixer, ops } = createMockFixer();
		fixFn(fixer);
		expect(ops).toEqual([{ op: 'replaceText', text: 'newText' }]);
	});

	test('insertBefore calls fixer.insertTextBefore', () => {
		const node = rangedNode();
		const fixFn = Diagnostic.insertBefore(node, 'prefix');
		const { fixer, ops } = createMockFixer();
		fixFn(fixer);
		expect(ops).toEqual([{ op: 'insertTextBefore', text: 'prefix' }]);
	});

	test('insertAfter calls fixer.insertTextAfter', () => {
		const node = rangedNode();
		const fixFn = Diagnostic.insertAfter(node, 'suffix');
		const { fixer, ops } = createMockFixer();
		fixFn(fixer);
		expect(ops).toEqual([{ op: 'insertTextAfter', text: 'suffix' }]);
	});

	test('removeFix calls fixer.remove', () => {
		const node = rangedNode();
		const fixFn = Diagnostic.removeFix(node);
		const { fixer, ops } = createMockFixer();
		fixFn(fixer);
		expect(ops).toEqual([{ op: 'remove' }]);
	});
});

// ---------------------------------------------------------------------------
// composeFixes
// ---------------------------------------------------------------------------

describe('Diagnostic.composeFixes', () => {
	test('composes multiple fix functions into one', () => {
		const node = rangedNode();
		const fix1 = Diagnostic.replaceText(node, 'a');
		const fix2 = Diagnostic.insertAfter(node, 'b');
		const composed = Diagnostic.composeFixes(fix1, fix2);

		const { fixer, ops } = createMockFixer();
		const result = composed(fixer);

		expect(ops).toEqual([
			{ op: 'replaceText', text: 'a' },
			{ op: 'insertTextAfter', text: 'b' }
		]);
		expect(Array.isArray(result)).toBe(true);
	});

	test('handles single fix', () => {
		const node = rangedNode();
		const fix = Diagnostic.replaceText(node, 'x');
		const composed = Diagnostic.composeFixes(fix);
		const { fixer } = createMockFixer();
		const result = composed(fixer);
		expect(Array.isArray(result)).toBe(true);
	});

	test('handles empty fixes', () => {
		const composed = Diagnostic.composeFixes();
		const { fixer } = createMockFixer();
		const result = composed(fixer);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});
