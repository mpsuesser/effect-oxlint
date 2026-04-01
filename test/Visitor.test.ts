import { describe, expect, it } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import * as R from 'effect/Record';
import * as Ref from 'effect/Ref';

import * as Visitor from '../src/Visitor.ts';
import { callOfMember, mockRuleContextLayer, throwStmt } from './_builders.ts';

/**
 * Most visitor tests need RuleContext in scope because EffectHandler's
 * return type is `Effect<void, never, RuleContext>`. We provide a mock
 * layer so the tests can yield handlers without hitting a missing service.
 */
const TestLayer = mockRuleContextLayer();

// ---------------------------------------------------------------------------
// Visitor.on
// ---------------------------------------------------------------------------

describe('Visitor.on', () => {
	it('creates a visitor with the given node type key', () => {
		const visitor = Visitor.on('ThrowStatement', () => Effect.void);
		expect(visitor['ThrowStatement']).toBeDefined();
		expect(visitor['ThrowStatement:exit']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.onExit
// ---------------------------------------------------------------------------

describe('Visitor.onExit', () => {
	it('creates a visitor with the exit key', () => {
		const visitor = Visitor.onExit('CallExpression', () => Effect.void);
		expect(visitor['CallExpression:exit']).toBeDefined();
		expect(visitor['CallExpression']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Visitor.merge
// ---------------------------------------------------------------------------

describe('Visitor.merge', () => {
	it('combines visitors for different node types', () => {
		const v1 = Visitor.on('ThrowStatement', () => Effect.void);
		const v2 = Visitor.on('CallExpression', () => Effect.void);
		const merged = Visitor.merge(v1, v2);
		expect(merged['ThrowStatement']).toBeDefined();
		expect(merged['CallExpression']).toBeDefined();
	});

	it.effect('sequences handlers for the same node type', () => {
		const program = Effect.gen(function* () {
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
				yield* handler(throwStmt() as never);
			}

			const result = yield* Ref.get(log);
			expect(result).toEqual(['first', 'second']);
		});
		return Effect.provide(program, TestLayer);
	});

	it('handles empty visitor array', () => {
		const merged = Visitor.merge();
		expect(R.keys(merged)).toHaveLength(0);
	});

	it('merges three or more visitors', () => {
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
		() => {
			const program = Effect.gen(function* () {
				const depth = yield* Ref.make(0);
				const visitor = Visitor.tracked(
					'CallExpression',
					() => true,
					depth
				);

				const node = callOfMember('Effect', 'gen');

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
			});
			return Effect.provide(program, TestLayer);
		}
	);

	it.effect('does not change ref when predicate returns false', () => {
		const program = Effect.gen(function* () {
			const depth = yield* Ref.make(0);
			const visitor = Visitor.tracked(
				'CallExpression',
				() => false,
				depth
			);

			const node = callOfMember('console', 'log');
			const enterHandler = visitor['CallExpression'];
			if (enterHandler) {
				yield* enterHandler(node as never);
			}
			expect(yield* Ref.get(depth)).toBe(0);
		});
		return Effect.provide(program, TestLayer);
	});

	it('creates both enter and exit handlers', () => {
		const ref = Ref.makeUnsafe(0);
		const visitor = Visitor.tracked('CallExpression', () => true, ref);
		expect(visitor['CallExpression']).toBeDefined();
		expect(visitor['CallExpression:exit']).toBeDefined();
	});
});
