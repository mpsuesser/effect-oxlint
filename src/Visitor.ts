/**
 * Composable visitor construction for Effect-first oxlint rules.
 *
 * Visitors are maps from AST node type names to Effect-returning handlers.
 * This module provides combinators to build, merge, and enhance visitors.
 *
 * @since 0.1.0
 */
import type { ESTree, Visitor as OxlintVisitor } from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { dual, pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import * as R from 'effect/Record';
import * as Ref from 'effect/Ref';

import { RuleContext } from './RuleContext.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An effectful visitor handler.
 *
 * Receives an AST node and returns an `Effect<void>` that may read/write
 * `Ref` state and report diagnostics via `RuleContext`.
 *
 * ## Error channel
 *
 * The error channel is **fixed to `never`** — handlers cannot fail via
 * `Effect.fail` because oxlint's plugin API is synchronous and has no
 * notion of a typed rule failure. Every handler runs through
 * `Effect.runSync` at the FFI boundary in `Rule.define`, and any defect
 * would crash the linter for the whole file.
 *
 * If a handler needs to call an effect that *can* fail, catch the error
 * in the handler and surface it as a diagnostic (or suppress it). For
 * example:
 *
 * ```ts
 * Visitor.on('CallExpression', (node) =>
 *   someFallibleEffect(node).pipe(
 *     Effect.catch((error) =>
 *       RuleContext.report({ node, message: `rule failure: ${error._tag}` })
 *     )
 *   )
 * )
 * ```
 *
 * Defects (thrown exceptions, `Effect.die`) are not caught here and will
 * propagate out of the linter. Reserve them for genuine invariant
 * violations.
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
 * This is the internal representation — handlers accept `ESTree.Node`.
 *
 * @since 0.1.0
 */
export type EffectVisitor = {
	readonly [key: string]: EffectHandler;
};

/** @internal Extract the node parameter type from an oxlint visitor handler. */
type ExtractNode<H> = H extends
	| ((node: infer N) => unknown)
	| { bivarianceHack(node: infer N): void }
	? N
	: ESTree.Node;

/**
 * Resolve a visitor key to its narrowed node type.
 *
 * For known keys (e.g. `'CallExpression'`), returns the specific
 * ESTree node type. For unknown keys, falls back to `ESTree.Node`.
 *
 * @since 0.2.0
 */
export type VisitorNodeType<K extends string> = K extends keyof OxlintVisitor
	? ExtractNode<Exclude<OxlintVisitor[K], undefined>>
	: ESTree.Node;

/**
 * Typed visitor map where known oxlint visitor keys provide the
 * correctly narrowed node type to handlers (e.g. `MemberExpression`
 * handlers receive `ESTree.MemberExpression`).
 *
 * Return this from `Rule.define`'s `create` generator. Callers get
 * typed nodes in their handlers without manual narrowing.
 *
 * @since 0.2.0
 */
export type TypedEffectVisitor = {
	readonly [K in keyof OxlintVisitor]?: EffectHandler<
		ExtractNode<Exclude<OxlintVisitor[K], undefined>>
	>;
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
	handler: EffectHandler<VisitorNodeType<K>>
): EffectVisitor => ({ [nodeType]: handler as EffectHandler });

/**
 * Create a single-entry visitor for the exit phase of a node type.
 *
 * @since 0.1.0
 */
export const onExit = <K extends string>(
	nodeType: K,
	handler: EffectHandler<VisitorNodeType<K>>
): EffectVisitor => ({ [`${nodeType}:exit`]: handler as EffectHandler });

// ---------------------------------------------------------------------------
// Combinators
// ---------------------------------------------------------------------------

/** @internal Empty visitor seed for reduce operations. */
const emptyVisitor: EffectVisitor = {};

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
	Arr.reduce(visitors, emptyVisitor, (acc, visitor) =>
		R.union(acc, visitor, (left, right) => sequenceHandlers(left, right))
	);

/**
 * Create an enter/exit visitor pair that increments a `Ref<number>` on
 * enter and decrements on exit, but only when the predicate matches.
 *
 * This replaces the common `let depth = 0` mutable counter pattern.
 *
 * The predicate receives the narrowed node type for the given key
 * (e.g. `ESTree.CallExpression` for `'CallExpression'`).
 *
 * @example
 * ```ts
 * const effectGenDepth = yield* Ref.make(0)
 *
 * Visitor.tracked('CallExpression',
 *   (node) => AST.isCallOf(node, 'Effect', 'gen'),
 *   effectGenDepth
 * )
 * ```
 *
 * @since 0.1.0
 */
export const tracked = <K extends string>(
	nodeType: K,
	predicate: (node: VisitorNodeType<K>) => boolean,
	ref: Ref.Ref<number>
): EffectVisitor => ({
	[nodeType]: (node: ESTree.Node) =>
		predicate(node as VisitorNodeType<K>)
			? Ref.update(ref, (n) => n + 1)
			: Effect.void,
	[`${nodeType}:exit`]: (node: ESTree.Node) =>
		predicate(node as VisitorNodeType<K>)
			? Ref.update(ref, (n) => n - 1)
			: Effect.void
});

/**
 * Conditionally apply a visitor based on a predicate evaluated once
 * at create time.
 *
 * Useful for restricting a visitor to specific files (e.g. skip test files).
 *
 * @example
 * ```ts
 * Visitor.filter(
 *   (filename) => !filename.endsWith('.test.ts'),
 *   mainVisitor
 * )
 * ```
 *
 * @since 0.2.0
 */
export const filter: {
	(
		predicate: (filename: string) => boolean
	): (
		visitor: EffectVisitor
	) => Effect.Effect<EffectVisitor, never, RuleContext>;
	(
		predicate: (filename: string) => boolean,
		visitor: EffectVisitor
	): Effect.Effect<EffectVisitor, never, RuleContext>;
} = dual(
	2,
	(
		predicate: (filename: string) => boolean,
		visitor: EffectVisitor
	): Effect.Effect<EffectVisitor, never, RuleContext> =>
		Effect.service(RuleContext).pipe(
			Effect.map((ctx) => (predicate(ctx.filename) ? visitor : {}))
		)
);

/**
 * Accumulate values during traversal and analyze them at `Program:exit`.
 *
 * The `extract` function is called for each node of `nodeType`. If it
 * returns `Option.some(value)`, that value is accumulated. At
 * `Program:exit`, the `analyze` generator receives all collected items.
 *
 * @example
 * ```ts
 * Visitor.accumulate(
 *   'ExportNamedDeclaration',
 *   (node) => AST.narrow(node, 'ExportNamedDeclaration').pipe(
 *     Option.map(n => n.declaration)
 *   ),
 *   function*(accumulated) {
 *     // Analyze all collected declarations at end of file
 *   }
 * )
 * ```
 *
 * @since 0.2.0
 */
export const accumulate = <A>(
	nodeType: string,
	extract: (node: ESTree.Node) => Option.Option<A>,
	analyze: (
		items: ReadonlyArray<A>
	) => Effect.Effect<void, never, RuleContext>
): Effect.Effect<EffectVisitor, never, RuleContext> =>
	Effect.gen(function* () {
		const ref = yield* Ref.make<ReadonlyArray<A>>([]);
		return merge(
			on(nodeType, (node) =>
				pipe(
					extract(node),
					Option.match({
						onNone: () => Effect.void,
						onSome: (value) =>
							Ref.update(ref, (items) => [...items, value])
					})
				)
			),
			on('Program:exit', () =>
				Effect.flatMap(Ref.get(ref), (items) => analyze(items))
			)
		);
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
	R.map(
		effectVisitor,
		(handler) => (node: ESTree.Node) => runHandler(handler(node))
	);
