/**
 * Composable visitor construction for Effect-first oxlint rules.
 *
 * Visitors are maps from AST node type names to Effect-returning handlers.
 * This module provides combinators to build, merge, and enhance visitors.
 *
 * @since 0.1.0
 */
import type { ESTree, Visitor as OxlintVisitor } from '@oxlint/plugins';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as R from 'effect/Record';
import * as Ref from 'effect/Ref';

import type { RuleContext } from './RuleContext.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An effectful visitor handler.
 *
 * Receives an AST node and returns an `Effect<void>` that may read/write
 * `Ref` state and report diagnostics via `RuleContext`.
 *
 * @since 0.1.0
 */
export type EffectHandler<N = ESTree.Node> = (
	node: N
) => Effect.Effect<void, never, RuleContext>;

/**
 * A map from AST node type names (and `"NodeType:exit"` variants) to
 * effectful handlers.
 *
 * This is the Effect-first equivalent of `@oxlint/plugins`' `Visitor`.
 *
 * @since 0.1.0
 */
export type EffectVisitor = {
	readonly [key: string]: EffectHandler | undefined;
};

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Create a single-entry visitor that handles one node type.
 *
 * The handler is a generator function that can `yield*` Effects.
 *
 * @example
 * ```ts
 * Visitor.on('ThrowStatement', function*(node) {
 *   const depth = yield* Ref.get(myDepthRef)
 *   if (depth > 0) {
 *     yield* RuleContext.report({ node, message: '...' })
 *   }
 * })
 * ```
 *
 * @since 0.1.0
 */
export const on = <K extends string>(
	nodeType: K,
	handler: EffectHandler
): EffectVisitor => ({ [nodeType]: handler });

/**
 * Create a single-entry visitor for the exit phase of a node type.
 *
 * @since 0.1.0
 */
export const onExit = <K extends string>(
	nodeType: K,
	handler: EffectHandler
): EffectVisitor => ({ [`${nodeType}:exit`]: handler });

// ---------------------------------------------------------------------------
// Combinators
// ---------------------------------------------------------------------------

/** @internal Combine two handlers for the same node type into one sequential handler. */
const sequenceHandlers =
	(left: EffectHandler, right: EffectHandler): EffectHandler =>
	(node) =>
		Effect.andThen(left(node), right(node));

/**
 * Merge multiple visitors into one.
 *
 * When two visitors handle the same node type, both handlers run
 * sequentially (left to right).
 *
 * @since 0.1.0
 */
export const merge = (
	...visitors: ReadonlyArray<EffectVisitor>
): EffectVisitor =>
	visitors.reduce<EffectVisitor>(
		(acc, visitor) =>
			pipe(
				R.union(
					acc as Record<string, EffectHandler>,
					pipe(
						visitor as Record<string, EffectHandler | undefined>,
						R.filter((h): h is EffectHandler => h !== undefined)
					),
					(left, right) => sequenceHandlers(left, right)
				)
			),
		{}
	);

/**
 * Create an enter/exit visitor pair that increments a `Ref<number>` on
 * enter and decrements on exit, but only when the predicate matches.
 *
 * This replaces the common `let depth = 0` mutable counter pattern.
 *
 * @example
 * ```ts
 * const effectGenDepth = yield* Ref.make(0)
 * Visitor.tracked('CallExpression',
 *   (node) => AST.isCallOf(node, 'Effect', 'gen'),
 *   effectGenDepth
 * )
 * ```
 *
 * @since 0.1.0
 */
export const tracked = (
	nodeType: string,
	predicate: (node: ESTree.Node) => boolean,
	ref: Ref.Ref<number>
): EffectVisitor => ({
	[nodeType]: (node: ESTree.Node) =>
		predicate(node) ? Ref.update(ref, (n) => n + 1) : Effect.void,
	[`${nodeType}:exit`]: (node: ESTree.Node) =>
		predicate(node) ? Ref.update(ref, (n) => n - 1) : Effect.void
});

// ---------------------------------------------------------------------------
// Conversion (internal — used by Rule.define at the runtime boundary)
// ---------------------------------------------------------------------------

/**
 * Convert an `EffectVisitor` to a plain oxlint `Visitor` by wrapping
 * each handler with the provided runner function.
 *
 * This is the runtime boundary where Effects are executed. Called once
 * per file inside `Rule.define`'s `create`.
 *
 * @internal
 */
export const toOxlintVisitor = (
	effectVisitor: EffectVisitor,
	runHandler: (effect: Effect.Effect<void, never, RuleContext>) => void
): OxlintVisitor =>
	pipe(
		effectVisitor as Record<string, EffectHandler | undefined>,
		R.filter((h): h is EffectHandler => h !== undefined),
		R.map((handler) => (node: ESTree.Node) => runHandler(handler(node)))
	) as OxlintVisitor;
