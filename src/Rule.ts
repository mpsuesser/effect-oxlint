/**
 * Core rule builder for Effect-first oxlint rules.
 *
 * `Rule.define` is the primary entry point. It produces a standard
 * `CreateRule` that oxlint can consume, while letting rule authors
 * write fully effectful create generators and visitor handlers.
 *
 * @since 0.1.0
 */
import type { CreateRule, ESTree, RuleDocs, RuleMeta } from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as Schema from 'effect/Schema';

import { pipe } from 'effect/Function';

import * as AST from './AST.ts';
import { make as makeDiagnostic } from './Diagnostic.ts';
import { fromOxlintContext, RuleContext } from './RuleContext.ts';
import type { EffectVisitor, TypedEffectVisitor } from './Visitor.ts';
import { merge as mergeVisitors, toOxlintVisitor } from './Visitor.ts';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the identifier name from a `NewExpression` callee.
 *
 * `AST.calleeName` only accepts `CallExpression`. This mirrors the
 * same logic for `NewExpression.callee`.
 *
 * @internal
 */
const newExprCalleeName = (callee: ESTree.Expression): Option.Option<string> =>
	callee.type === 'Identifier' && 'name' in callee && P.isString(callee.name)
		? Option.some(callee.name)
		: Option.none();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration object for `Rule.define`.
 *
 * @since 0.1.0
 */
export interface RuleConfig<Options = undefined> {
	/** Rule name (used for tracing spans). */
	readonly name: string;
	/** Oxlint rule metadata. */
	readonly meta: RuleMeta;
	/**
	 * Optional Schema for rule options.
	 *
	 * When provided, the first element of the raw JSON options array
	 * is decoded at `create` time against this schema.
	 */
	readonly options?: Schema.Decoder<Options> | undefined;
	/**
	 * The create generator.
	 *
	 * Receives decoded options and returns an `EffectVisitor`.
	 * Runs inside an Effect context where `RuleContext` is available.
	 *
	 * May `yield* Ref.make(...)` for state, `yield* RuleContext` for
	 * context access, and return a visitor built with `Visitor.*` helpers.
	 */
	readonly create: (
		options: Options
	) => Effect.gen.Return<TypedEffectVisitor, never, RuleContext>;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Define an Effect-first oxlint lint rule.
 *
 * The `create` generator runs once per file via `Effect.runSync`.
 * Each visitor handler is also executed via `Effect.runSync` per node.
 * `Ref`-based state created in `create` persists across handler calls
 * via closure.
 *
 * `Effect.runSync` is used here at the runtime boundary — the bridge
 * between oxlint's synchronous plugin API and our Effect world.
 *
 * @since 0.1.0
 */
export const define = <Options = undefined>(
	config: RuleConfig<Options>
): CreateRule => ({
	meta: config.meta,
	create(oxlintContext) {
		const ruleCtx = fromOxlintContext(oxlintContext);

		// Runtime boundary: execute effects with RuleContext provided.
		// This is the FFI bridge between oxlint's sync API and Effect.
		const run = <A>(effect: Effect.Effect<A, never, RuleContext>): A =>
			Effect.runSync(Effect.provideService(effect, RuleContext, ruleCtx));

		// Decode options from the raw JSON array.
		// When no schema is configured, `Options` defaults to `undefined`.
		const decodeOptions = (): Options => {
			const schema = config.options;
			if (schema === undefined) return undefined as Options;
			return Schema.decodeUnknownSync(schema)(oxlintContext.options[0]);
		};
		const options = run(Effect.sync(decodeOptions));

		// Run the create generator to set up Refs and get the visitor map.
		// TypedEffectVisitor → EffectVisitor: the typed keys provide
		// narrowed nodes to callers, but at runtime all handlers receive
		// the same ESTree.Node values. The variance mismatch is safe
		// because oxlint guarantees the node type matches the key.
		const effectVisitor = run(
			Effect.gen(() => config.create(options))
		) as EffectVisitor;

		// Wrap each handler: Effect<void> → plain () => void
		return toOxlintVisitor(effectVisitor, run);
	}
});

// ---------------------------------------------------------------------------
// Metadata helper
// ---------------------------------------------------------------------------

/**
 * Build `RuleMeta` with sensible defaults.
 *
 * @since 0.1.0
 */
export const meta = (opts: {
	readonly type: 'problem' | 'suggestion' | 'layout';
	readonly description: string;
	readonly fixable?: 'code' | 'whitespace' | undefined;
	readonly hasSuggestions?: boolean | undefined;
	readonly messages?: Record<string, string> | undefined;
	readonly docs?: RuleDocs | undefined;
}): RuleMeta => ({
	type: opts.type,
	...(opts.fixable !== undefined ? { fixable: opts.fixable } : {}),
	...(opts.hasSuggestions !== undefined
		? { hasSuggestions: opts.hasSuggestions }
		: {}),
	...(opts.messages !== undefined ? { messages: opts.messages } : {}),
	docs: {
		description: opts.description,
		...opts.docs
	}
});

// ---------------------------------------------------------------------------
// Convenience rule factories (common patterns)
// ---------------------------------------------------------------------------

/**
 * Create a rule that bans `obj.prop` member expression access.
 *
 * Replaces the common `memberExprRule` utility pattern.
 *
 * @since 0.1.0
 */
export const banMember = (
	obj: string,
	prop: string | ReadonlyArray<string>,
	opts: {
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule =>
	define({
		name: `ban-${obj}-${P.isString(prop) ? prop : Arr.join(prop, '-')}`,
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			return {
				MemberExpression: (node: ESTree.Node) =>
					pipe(
						AST.narrow(node, 'MemberExpression'),
						Option.flatMap(AST.matchMember(obj, prop)),
						Option.match({
							onNone: () => Effect.void,
							onSome: (matched) =>
								ctx.report(
									makeDiagnostic({
										node: matched,
										message: opts.message
									})
								)
						})
					)
			};
		}
	});

/**
 * Create a rule that bans imports matching a source string or predicate.
 *
 * Replaces the common `importRule` utility pattern.
 *
 * @since 0.1.0
 */
export const banImport = (
	source: string | ((source: string) => boolean),
	opts: {
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule =>
	define({
		name: 'ban-import',
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			return {
				ImportDeclaration: (node: ESTree.Node) =>
					pipe(
						AST.narrow(node, 'ImportDeclaration'),
						Option.flatMap(AST.matchImport(source)),
						Option.match({
							onNone: () => Effect.void,
							onSome: (matched) =>
								ctx.report(
									makeDiagnostic({
										node: matched,
										message: opts.message
									})
								)
						})
					)
			};
		}
	});

/**
 * Create a rule that bans bare identifier call expressions.
 *
 * Matches `CallExpression` nodes whose callee is an identifier in
 * the given list (e.g. `fetch()`, `useState()`, `readFileSync()`).
 *
 * @example
 * ```ts
 * // Ban a single call
 * Rule.banCallOf('fetch', { message: 'Use Effect HTTP client' })
 *
 * // Ban multiple calls
 * Rule.banCallOf(['useState', 'useEffect'], { message: 'Use Effect' })
 * ```
 *
 * @since 0.2.0
 */
export const banCallOf = (
	name: string | ReadonlyArray<string>,
	opts: {
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule => {
	const names = P.isString(name) ? [name] : name;
	return define({
		name: `ban-call-${Arr.join(names, '-')}`,
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			return {
				CallExpression: (node: ESTree.Node) =>
					pipe(
						AST.narrow(node, 'CallExpression'),
						Option.flatMap(AST.calleeName),
						Option.filter((n) => Arr.contains(names, n)),
						Option.match({
							onNone: () => Effect.void,
							onSome: () =>
								ctx.report(
									makeDiagnostic({
										node,
										message: opts.message
									})
								)
						})
					)
			};
		}
	});
};

/**
 * Create a rule that bans `new` expressions with the given callee name.
 *
 * Matches `NewExpression` nodes whose callee is an identifier in
 * the given list (e.g. `new Date()`, `new Error()`).
 *
 * @example
 * ```ts
 * // Ban a single constructor
 * Rule.banNewExpr('Date', { message: 'Use Clock service' })
 *
 * // Ban multiple constructors
 * Rule.banNewExpr(['Error', 'TypeError'], { message: 'Use tagged errors' })
 * ```
 *
 * @since 0.2.0
 */
export const banNewExpr = (
	name: string | ReadonlyArray<string>,
	opts: {
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule => {
	const names = P.isString(name) ? [name] : name;
	return define({
		name: `ban-new-${Arr.join(names, '-')}`,
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			return {
				NewExpression: (node: ESTree.Node) =>
					pipe(
						AST.narrow(node, 'NewExpression'),
						Option.flatMap((n) => newExprCalleeName(n.callee)),
						Option.filter((n) => Arr.contains(names, n)),
						Option.match({
							onNone: () => Effect.void,
							onSome: () =>
								ctx.report(
									makeDiagnostic({
										node,
										message: opts.message
									})
								)
						})
					)
			};
		}
	});
};

/**
 * Create a rule that bans a specific statement type.
 *
 * @since 0.1.0
 */
export const banStatement = (
	nodeType: string,
	opts: {
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule =>
	define({
		name: `ban-${nodeType}`,
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			return {
				[nodeType]: (node: ESTree.Node) =>
					ctx.report(makeDiagnostic({ node, message: opts.message }))
			};
		}
	});

// ---------------------------------------------------------------------------
// Multi-ban combinator
// ---------------------------------------------------------------------------

/**
 * Specification for `banMultiple`: which patterns to ban under one rule.
 *
 * @since 0.2.0
 */
export interface BanMultipleSpec {
	/** Bare identifier calls to ban (e.g. `'fetch'` or `['useState', 'useEffect']`). */
	readonly calls?: string | ReadonlyArray<string> | undefined;
	/** `new` expressions to ban (e.g. `'Date'` or `['Error', 'TypeError']`). */
	readonly newExprs?: string | ReadonlyArray<string> | undefined;
	/** Member expressions to ban: `[object, property | properties]` tuples. */
	readonly members?:
		| ReadonlyArray<
				readonly [obj: string, prop: string | ReadonlyArray<string>]
		  >
		| undefined;
	/** Import sources to ban (string or predicate). */
	readonly imports?:
		| ReadonlyArray<string | ((source: string) => boolean)>
		| undefined;
	/** Statement node types to ban (e.g. `'ThrowStatement'`). */
	readonly statements?: ReadonlyArray<string> | undefined;
}

/**
 * Create a rule that bans multiple patterns with a shared message.
 *
 * Combines call bans, `new` expression bans, member bans, import bans,
 * and statement bans into a single rule with merged visitors.
 *
 * @example
 * ```ts
 * // Ban 5 loop statement types
 * Rule.banMultiple(
 *   {
 *     statements: [
 *       'ForStatement', 'ForInStatement', 'ForOfStatement',
 *       'WhileStatement', 'DoWhileStatement'
 *     ]
 *   },
 *   { message: 'Use Arr.map / Effect.forEach instead' }
 * )
 *
 * // Combine import + member bans
 * Rule.banMultiple(
 *   {
 *     imports: ['node:fs'],
 *     members: [['fs', ['readFileSync', 'writeFileSync']]]
 *   },
 *   { message: 'Use Effect FileSystem service' }
 * )
 *
 * // Combine new expression + member bans
 * Rule.banMultiple(
 *   {
 *     newExprs: 'Date',
 *     members: [['Date', 'now']]
 *   },
 *   { message: 'Use Clock service' }
 * )
 * ```
 *
 * @since 0.2.0
 */
export const banMultiple = (
	spec: BanMultipleSpec,
	opts: {
		readonly name?: string | undefined;
		readonly message: string;
		readonly meta?:
			| { readonly type?: 'problem' | 'suggestion' }
			| undefined;
	}
): CreateRule =>
	define({
		name: opts.name ?? 'ban-multiple',
		meta: meta({
			type: opts.meta?.type ?? 'suggestion',
			description: opts.message
		}),
		create: function* () {
			const ctx = yield* RuleContext;
			const report = (node: ESTree.Node) =>
				ctx.report(makeDiagnostic({ node, message: opts.message }));

			// Statement bans
			const stmtVisitors: ReadonlyArray<EffectVisitor> =
				spec.statements !== undefined
					? Arr.map(
							spec.statements,
							(nodeType): EffectVisitor => ({
								[nodeType]: report
							})
						)
					: [];

			// Call bans
			const callVisitors: ReadonlyArray<EffectVisitor> =
				spec.calls !== undefined
					? ((names: ReadonlyArray<string>) => [
							{
								CallExpression: (node: ESTree.Node) =>
									pipe(
										AST.narrow(node, 'CallExpression'),
										Option.flatMap(AST.calleeName),
										Option.filter((n) =>
											Arr.contains(names, n)
										),
										Option.match({
											onNone: () => Effect.void,
											onSome: () => report(node)
										})
									)
							} satisfies EffectVisitor
						])(P.isString(spec.calls) ? [spec.calls] : spec.calls)
					: [];

			// NewExpression bans
			const newExprVisitors: ReadonlyArray<EffectVisitor> =
				spec.newExprs !== undefined
					? ((names: ReadonlyArray<string>) => [
							{
								NewExpression: (node: ESTree.Node) =>
									pipe(
										AST.narrow(node, 'NewExpression'),
										Option.flatMap((n) =>
											newExprCalleeName(n.callee)
										),
										Option.filter((n) =>
											Arr.contains(names, n)
										),
										Option.match({
											onNone: () => Effect.void,
											onSome: () => report(node)
										})
									)
							} satisfies EffectVisitor
						])(
							P.isString(spec.newExprs)
								? [spec.newExprs]
								: spec.newExprs
						)
					: [];

			// Member bans
			const memberVisitors: ReadonlyArray<EffectVisitor> =
				spec.members !== undefined
					? Arr.map(
							spec.members,
							([obj, prop]): EffectVisitor => ({
								MemberExpression: (node: ESTree.Node) =>
									pipe(
										AST.narrow(node, 'MemberExpression'),
										Option.flatMap(
											AST.matchMember(obj, prop)
										),
										Option.match({
											onNone: () => Effect.void,
											onSome: (matched) => report(matched)
										})
									)
							})
						)
					: [];

			// Import bans
			const importVisitors: ReadonlyArray<EffectVisitor> =
				spec.imports !== undefined
					? Arr.map(
							spec.imports,
							(source): EffectVisitor => ({
								ImportDeclaration: (node: ESTree.Node) =>
									pipe(
										AST.narrow(node, 'ImportDeclaration'),
										Option.flatMap(AST.matchImport(source)),
										Option.match({
											onNone: () => Effect.void,
											onSome: (matched) => report(matched)
										})
									)
							})
						)
					: [];

			return mergeVisitors(
				...stmtVisitors,
				...callVisitors,
				...newExprVisitors,
				...memberVisitors,
				...importVisitors
			);
		}
	});
