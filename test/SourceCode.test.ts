import { describe, expect, it } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import * as SourceCode from '../src/SourceCode.ts';
import { Testing } from '../src/index.ts';

const TestLayer = Testing.mockRuleContextLayer();

// ---------------------------------------------------------------------------
// getText
// ---------------------------------------------------------------------------

describe('SourceCode.getText', () => {
	it.effect('returns the source text', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.getText();
			expect(result).toBe('');
		}).pipe(Effect.provide(TestLayer))
	);

	it.effect('returns text from context with custom source', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.getText();
			expect(result).toBe('const x = 1;');
		}).pipe(
			Effect.provide(
				Testing.mockRuleContextLayer({ sourceText: 'const x = 1;' })
			)
		)
	);
});

// ---------------------------------------------------------------------------
// getAllComments
// ---------------------------------------------------------------------------

describe('SourceCode.getAllComments', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.getAllComments();
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// getLocFromIndex
// ---------------------------------------------------------------------------

describe('SourceCode.getLocFromIndex', () => {
	it.effect('converts offset to line/column', () =>
		Effect.gen(function* () {
			const loc = yield* SourceCode.getLocFromIndex(5);
			expect(loc).toEqual({ line: 1, column: 5 });
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// getNodeByRangeIndex
// ---------------------------------------------------------------------------

describe('SourceCode.getNodeByRangeIndex', () => {
	it.effect('returns None from mock (no nodes)', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.getNodeByRangeIndex(0);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Token queries
// ---------------------------------------------------------------------------

describe('SourceCode.getFirstToken', () => {
	it.effect('returns None from mock (no tokens)', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getFirstToken(node);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getLastToken', () => {
	it.effect('returns None from mock (no tokens)', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getLastToken(node);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getTokenBefore', () => {
	it.effect('returns None from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getTokenBefore(node);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getTokenAfter', () => {
	it.effect('returns None from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getTokenAfter(node);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Comment queries
// ---------------------------------------------------------------------------

describe('SourceCode.getCommentsBefore', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getCommentsBefore(node);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.commentsExistBetween', () => {
	it.effect('returns false from mock', () =>
		Effect.gen(function* () {
			const a = { type: 'Program', body: [] } as never;
			const b = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.commentsExistBetween(a, b);
			expect(result).toBe(false);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Scope queries
// ---------------------------------------------------------------------------

describe('SourceCode.getScope', () => {
	it.effect('returns a scope from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const scope = yield* SourceCode.getScope(node);
			expect(scope).toBeDefined();
			expect(scope.type).toBe('function');
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getDeclaredVariables', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const vars = yield* SourceCode.getDeclaredVariables(node);
			expect(vars).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.isGlobalReference', () => {
	it.effect('returns false from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Identifier', name: 'x' } as never;
			const result = yield* SourceCode.isGlobalReference(node);
			expect(result).toBe(false);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

describe('SourceCode.isSpaceBetween', () => {
	it.effect('returns false from mock', () =>
		Effect.gen(function* () {
			const a = { type: 'Program', body: [] } as never;
			const b = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.isSpaceBetween(a, b);
			expect(result).toBe(false);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

describe('SourceCode.getLines', () => {
	it.effect('returns source lines', () =>
		Effect.gen(function* () {
			const lines = yield* SourceCode.getLines();
			expect(lines).toEqual(['']);
		}).pipe(Effect.provide(TestLayer))
	);
});

// ---------------------------------------------------------------------------
// Additional coverage — previously untested exports
// ---------------------------------------------------------------------------

describe('SourceCode.getAncestors', () => {
	it.effect('returns empty ancestors from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Identifier', name: 'x' } as never;
			const result = yield* SourceCode.getAncestors(node);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getIndexFromLoc', () => {
	it.effect('converts line/column to offset', () =>
		Effect.gen(function* () {
			const idx = yield* SourceCode.getIndexFromLoc({
				line: 1,
				column: 5
			});
			expect(idx).toBe(5);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getRange', () => {
	it.effect('returns range from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getRange(node);
			expect(result).toEqual([0, 0]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getTokens', () => {
	it.effect('returns empty tokens from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getTokens(node);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getTokensBetween', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const a = { type: 'Program', body: [] } as never;
			const b = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getTokensBetween(a, b);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getFirstTokenBetween', () => {
	it.effect('returns None from mock', () =>
		Effect.gen(function* () {
			const a = { type: 'Program', body: [] } as never;
			const b = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getFirstTokenBetween(a, b);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getTokenByRangeStart', () => {
	it.effect('returns None from mock', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.getTokenByRangeStart(0);
			expect(Option.isNone(result)).toBe(true);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getCommentsAfter', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getCommentsAfter(node);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.getCommentsInside', () => {
	it.effect('returns empty array from mock', () =>
		Effect.gen(function* () {
			const node = { type: 'Program', body: [] } as never;
			const result = yield* SourceCode.getCommentsInside(node);
			expect(result).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});

describe('SourceCode.markVariableAsUsed', () => {
	it.effect('returns false from mock', () =>
		Effect.gen(function* () {
			const result = yield* SourceCode.markVariableAsUsed('x');
			expect(result).toBe(false);
		}).pipe(Effect.provide(TestLayer))
	);
});
