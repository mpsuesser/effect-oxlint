import { describe, expect, it, test } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as R from 'effect/Record';
import * as Ref from 'effect/Ref';

import * as Visitor from '../src/Visitor.ts';
import { Testing } from '../src/index.ts';

/**
 * Most visitor tests need RuleContext in scope because EffectHandler's
 * return type is `Effect<void, never, RuleContext>`. We provide a mock
 * layer so the tests can yield handlers without hitting a missing service.
 */
const TestLayer = Testing.mockRuleContextLayer();

// ---------------------------------------------------------------------------
// Visitor.on
// ---------------------------------------------------------------------------

describe('Visitor.on', () => {
	test('creates a visitor with the given node type key', () => {
		const visitor = Visitor.on('ThrowStatement', () => Effect.void);
		expect(visitor['ThrowStatement']).toBeDefined();
		expect(visitor['ThrowStatement:exit']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.onExit
// ---------------------------------------------------------------------------

describe('Visitor.onExit', () => {
	test('creates a visitor with the exit key', () => {
		const visitor = Visitor.onExit('CallExpression', () => Effect.void);
		expect(visitor['CallExpression:exit']).toBeDefined();
		expect(visitor['CallExpression']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.merge
// ---------------------------------------------------------------------------

describe('Visitor.merge', () => {
	test('combines visitors for different node types', () => {
		const v1 = Visitor.on('ThrowStatement', () => Effect.void);
		const v2 = Visitor.on('CallExpression', () => Effect.void);
		const merged = Visitor.merge(v1, v2);
		expect(merged['ThrowStatement']).toBeDefined();
		expect(merged['CallExpression']).toBeDefined();
	});

	it.effect('sequences handlers for the same node type', () =>
		Effect.gen(function* () {
			const log = yield* Ref.make<ReadonlyArray<string>>([]);

			const v1 = Visitor.on('ThrowStatement', () =>
				Ref.update(log, (arr) => [...arr, 'first'])
			);
			const v2 = Visitor.on('ThrowStatement', () =>
				Ref.update(log, (arr) => [...arr, 'second'])
			);
			const merged = Visitor.merge(v1, v2);

			const handler = merged['ThrowStatement'];
			if (handler) {
				yield* handler(Testing.throwStmt() as never);
			}

			const result = yield* Ref.get(log);
			expect(result).toEqual(['first', 'second']);
		}).pipe(Effect.provide(TestLayer))
	);

	test('handles empty visitor array', () => {
		const merged = Visitor.merge();
		expect(R.keys(merged)).toHaveLength(0);
	});

	test('merges three or more visitors', () => {
		const v1 = Visitor.on('A', () => Effect.void);
		const v2 = Visitor.on('B', () => Effect.void);
		const v3 = Visitor.on('C', () => Effect.void);
		const merged = Visitor.merge(v1, v2, v3);
		expect(merged['A']).toBeDefined();
		expect(merged['B']).toBeDefined();
		expect(merged['C']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.tracked
// ---------------------------------------------------------------------------

describe('Visitor.tracked', () => {
	it.effect(
		'increments ref on enter and decrements on exit when predicate matches',
		() =>
			Effect.gen(function* () {
				const depth = yield* Ref.make(0);
				const visitor = Visitor.tracked(
					'CallExpression',
					() => true,
					depth
				);

				const node = Testing.callOfMember('Effect', 'gen');

				// Enter handler — increment
				const enterHandler = visitor['CallExpression'];
				if (enterHandler) {
					yield* enterHandler(node as never);
				}
				expect(yield* Ref.get(depth)).toBe(1);

				// Enter again (nested) — increment to 2
				if (enterHandler) {
					yield* enterHandler(node as never);
				}
				expect(yield* Ref.get(depth)).toBe(2);

				// Exit once — decrement to 1
				const exitHandler = visitor['CallExpression:exit'];
				if (exitHandler) {
					yield* exitHandler(node as never);
				}
				expect(yield* Ref.get(depth)).toBe(1);

				// Exit again — decrement to 0
				if (exitHandler) {
					yield* exitHandler(node as never);
				}
				expect(yield* Ref.get(depth)).toBe(0);
			}).pipe(Effect.provide(TestLayer))
	);

	it.effect('does not change ref when predicate returns false', () =>
		Effect.gen(function* () {
			const depth = yield* Ref.make(0);
			const visitor = Visitor.tracked(
				'CallExpression',
				() => false,
				depth
			);

			const node = Testing.callOfMember('console', 'log');
			const enterHandler = visitor['CallExpression'];
			if (enterHandler) {
				yield* enterHandler(node as never);
			}
			expect(yield* Ref.get(depth)).toBe(0);
		}).pipe(Effect.provide(TestLayer))
	);

	test('creates both enter and exit handlers', () => {
		const ref = Ref.makeUnsafe(0);
		const visitor = Visitor.tracked('CallExpression', () => true, ref);
		expect(visitor['CallExpression']).toBeDefined();
		expect(visitor['CallExpression:exit']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.filter (Phase 2)
// ---------------------------------------------------------------------------

describe('Visitor.filter', () => {
	it.effect('returns the visitor when predicate matches', () =>
		Effect.gen(function* () {
			const inner = Visitor.on('ThrowStatement', () => Effect.void);
			const visitor = yield* Visitor.filter(
				(f) => f.endsWith('.ts'),
				inner
			);
			expect(visitor['ThrowStatement']).toBeDefined();
		}).pipe(Effect.provide(TestLayer))
	);

	it.effect('returns empty visitor when predicate fails', () =>
		Effect.gen(function* () {
			const inner = Visitor.on('ThrowStatement', () => Effect.void);
			const visitor = yield* Visitor.filter(
				(f) => f.endsWith('.js'),
				inner
			);
			expect(visitor['ThrowStatement']).toBeUndefined();
		}).pipe(Effect.provide(TestLayer))
	);

	it.effect('uses filename from RuleContext', () =>
		Effect.gen(function* () {
			const inner = Visitor.on('ThrowStatement', () => Effect.void);
			const visitor = yield* Visitor.filter(
				(f) => f.includes('custom'),
				inner
			);
			expect(visitor['ThrowStatement']).toBeDefined();
		}).pipe(
			Effect.provide(
				Testing.mockRuleContextLayer({ filename: '/custom/file.ts' })
			)
		)
	);
});

// ---------------------------------------------------------------------------
// Visitor.accumulate (Phase 2)
// ---------------------------------------------------------------------------

describe('Visitor.accumulate', () => {
	it.effect('collects matching items and calls analyze at Program:exit', () =>
		Effect.gen(function* () {
			const results = yield* Ref.make<ReadonlyArray<string>>([]);
			const visitor = yield* Visitor.accumulate<string>(
				'ImportDeclaration',
				(node) =>
					node.type === 'ImportDeclaration'
						? Option.some(node.source.value)
						: Option.none(),
				(items) => Ref.update(results, () => items)
			);

			// Simulate two import visitor events
			const enterHandler = visitor['ImportDeclaration'];
			expect(enterHandler).toBeDefined();
			if (enterHandler) {
				yield* enterHandler({
					type: 'ImportDeclaration',
					source: { value: 'effect' }
				} as never);
				yield* enterHandler({
					type: 'ImportDeclaration',
					source: { value: 'node:fs' }
				} as never);
			}

			// Simulate Program:exit
			const exitHandler = visitor['Program:exit'];
			expect(exitHandler).toBeDefined();
			if (exitHandler) {
				yield* exitHandler({ type: 'Program' } as never);
			}

			const accumulated = yield* Ref.get(results);
			expect(accumulated).toEqual(['effect', 'node:fs']);
		}).pipe(Effect.provide(TestLayer))
	);

	it.effect('skips items when extract returns None', () =>
		Effect.gen(function* () {
			const results = yield* Ref.make<ReadonlyArray<string>>([]);
			const visitor = yield* Visitor.accumulate<string>(
				'CallExpression',
				() => Option.none(),
				(items) => Ref.update(results, () => items)
			);

			const enterHandler = visitor['CallExpression'];
			expect(enterHandler).toBeDefined();
			if (enterHandler) {
				yield* enterHandler(Testing.callOfMember('a', 'b') as never);
			}

			const exitHandler = visitor['Program:exit'];
			expect(exitHandler).toBeDefined();
			if (exitHandler) {
				yield* exitHandler({ type: 'Program' } as never);
			}

			const accumulated = yield* Ref.get(results);
			expect(accumulated).toEqual([]);
		}).pipe(Effect.provide(TestLayer))
	);
});
