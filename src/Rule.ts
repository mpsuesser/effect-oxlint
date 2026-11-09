/**
 * Core rule builder for Effect-first oxlint rules.
 *
 * `Rule.define` is the primary entry point. It produces a standard
 * `CreateRule` that oxlint can consume, while letting rule authors
 * write fully effectful create generators and visitor handlers.
 *
 * @since 0.1.0
 */
import type {
	CreateRule,
	ESTree,
	Options as OxlintOptions,
	RuleDeprecatedInfo,
	RuleDocs,
	RuleMeta,
	RuleOptionsSchema
} from '@oxlint/plugins';
import type * as Cause from 'effect/Cause';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Str from 'effect/String';

import * as AST from './AST.ts';
import { make as makeDiagnostic } from './Diagnostic.ts';
import { fromOxlintContext, RuleContext } from './RuleContext.ts';
import type { EffectVisitor, TypedEffectVisitor } from './Visitor.ts';
import { merge as mergeVisitors, toOxlintVisitor } from './Visitor.ts';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a PascalCase / camelCase / acronym string to kebab-case for use
 * in generated rule names. Idempotent on already-kebab strings.
 *
 * @example
 * ```
 * kebab('ThrowStatement')  // 'throw-statement'
 * kebab('ForInStatement')  // 'for-in-statement'
 * kebab('JSON')            // 'json'
 * kebab('ban-fetch')       // 'ban-fetch'
 * ```
 *
 * @internal
 */
const kebab = (s: string): string =>
	pipe(
		s,
		Str.replace(/([a-z0-9])([A-Z])/g, '$1-$2'),
		Str.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2'),
		Str.toLowerCase
	);

/**
 * Render a list of identifier segments as a kebab-case rule-name tail.
 *
 * @internal
 */
const kebabList = (parts: ReadonlyArray<string>): string =>
	Arr.join(Arr.map(parts, kebab), '-');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration object for `Rule.define`.
 *
 * @since 0.1.0
 */
export interface RuleConfig<Options = undefined> {
	/**
	 * Rule name, used to identify the rule in error messages (for example
	 * when its options fail to decode).
	 *
	 * The ID oxlint reports comes from the key the rule is registered under
	 * in `Plugin.define`, not from this field.
	 */
	readonly name: string;
	/** Oxlint rule metadata. */
	readonly meta: RuleMeta;
	/**
	 * Optional Schema for rule options.
	 *
	 * When provided, the first element of the raw JSON options array
	 * is decoded at `create` time against this schema. Decoding failures
	 * surface as a `RuleOptionsError` defect naming the rule.
	 *
	 * oxlint only passes options to rules that declare `meta.schema`. If
	 * `meta.schema` is not set, `Rule.define` sets it to `false` (disabling
	 * oxlint's JSON Schema validation in favor of this schema). Set
	 * `meta.schema` yourself to also validate with JSON Schema.
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
// Errors
// ---------------------------------------------------------------------------

/** @internal Nominal brand for `RuleOptionsError`. */
declare const RuleOptionsErrorBrand: unique symbol;

/** @internal Explicitly typed base class, so JSR can type the export. */
const RuleOptionsErrorBase: Schema.Class<
	RuleOptionsError,
	Schema.TaggedStruct<
		'RuleOptionsError',
		{ readonly rule: Schema.String; readonly issue: Schema.String }
	>,
	Cause.YieldableError & {
		readonly [RuleOptionsErrorBrand]: typeof RuleOptionsErrorBrand;
	}
> = Schema.TaggedError<
	RuleOptionsError,
	{ readonly [RuleOptionsErrorBrand]: typeof RuleOptionsErrorBrand }
>()('RuleOptionsError', {
	rule: Schema.String,
	issue: Schema.String
});

/**
 * Raised when a rule's configured options do not match its `options` schema.
 *
 * oxlint's plugin API is synchronous and cannot carry typed failures, so
 * `Rule.define` raises this as a defect when the rule is created for a file.
 * The message names the rule (`rule`) and the schema issue (`issue`).
 *
 * @since 0.5.0
 */
export class RuleOptionsError extends RuleOptionsErrorBase {
	override get message(): string {
		return `Invalid options for rule "${this.rule}": ${this.issue}`;
	}
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * oxlint rejects options for any rule whose `meta.schema` is unset. When a
 * rule decodes its options with an Effect Schema, mark oxlint's JSON Schema
 * validation as disabled (`schema: false`) so the options reach `create`,
 * where the Effect Schema validates them. An explicit `meta.schema` wins.
 *
 * @internal
 */
const withOptionsSchema = <Options>(config: RuleConfig<Options>): RuleMeta =>
	config.options === undefined || config.meta.schema !== undefined
		? config.meta
		: { ...config.meta, schema: false };

/** @internal Decode the first raw option against the rule's schema. */
const decodeOptions = <Options>(
	config: RuleConfig<Options>,
	raw: Readonly<OxlintOptions>
): Effect.Effect<Options> =>
	config.options === undefined
		? // SAFETY: without an `options` schema, `Options` keeps its default
			// of `undefined`, which is the value supplied here.
			Effect.succeed(undefined as Options)
		: Schema.decodeEffect(config.options)(raw[0]).pipe(
				Effect.mapError(
					(error) =>
						new RuleOptionsError({
							rule: config.name,
							issue: error.message
						})
				),
				Effect.orDie
			);

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
 * ## Error channel
 *
 * Both the `create` generator and individual visitor handlers have a
 * fixed error channel of `never`. Rules cannot fail via `Effect.fail` —
 * any failure must be handled inside the handler (typically by
 * reporting a diagnostic through the `RuleContext` service). See
 * `EffectHandler` in `./Visitor.ts` for the full contract and the
 * recommended `Effect.catch` pattern for fallible sub-effects.
 *
 * Invalid rule options are the one exception: they raise a
 * `RuleOptionsError` defect when the rule is created.
 *
 * @example
 * ```ts
 * import * as Effect from 'effect/Effect'
 * import * as Schema from 'effect/Schema'
 * import { Diagnostic, Rule, RuleContext } from 'effect-oxlint'
 *
 * const maxParams = Rule.define({
 *   name: 'max-params',
 *   meta: Rule.meta({ type: 'suggestion', description: 'Limit parameters' }),
 *   options: Schema.Struct({ max: Schema.Number }),
 *   create: function* ({ max }) {
 *     const ctx = yield* RuleContext
 *     return {
 *       FunctionDeclaration: (node) =>
 *         node.params.length > max
 *           ? ctx.report(
 *               Diagnostic.make({ node, message: `More than ${max} params` })
 *             )
 *           : Effect.void
 *     }
 *   }
 * })
 * ```
 *
 * @since 0.1.0
 */
export const define = <Options = undefined>(
	config: RuleConfig<Options>
): CreateRule => ({
	meta: withOptionsSchema(config),
	create(oxlintContext) {
		const ruleCtx = fromOxlintContext(oxlintContext);

		// Runtime boundary: execute effects with RuleContext provided.
		// This is the FFI bridge between oxlint's sync API and Effect.
		const run = <A>(effect: Effect.Effect<A, never, RuleContext>): A =>
			Effect.runSync(Effect.provideService(effect, RuleContext, ruleCtx));

		const effectVisitor = run(
			decodeOptions(config, oxlintContext.options).pipe(
				Effect.flatMap((options) =>
					// SAFETY: `TypedEffectVisitor` narrows each handler's node
					// parameter by its key. oxlint only calls a handler with
					// nodes matching that key, so widening the parameters to
					// `ESTree.Node` cannot pass a handler the wrong node type.
					Effect.gen(() => config.create(options)).pipe(
						Effect.map((visitor) => visitor as EffectVisitor)
					)
				)
			)
		);

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
 * `description` is copied into `docs.description`; any `docs` passed
 * explicitly are merged on top. Optional fields are omitted from the
 * result when not provided.
 *
 * @example
 * ```ts
 * Rule.meta({
 *   type: 'problem',
 *   description: 'Disallow throw inside Effect.gen',
 *   fixable: 'code',
 *   messages: { noThrow: 'Use Effect.fail instead of throw' }
 * })
 * ```
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
	readonly schema?: RuleOptionsSchema | undefined;
	readonly defaultOptions?: OxlintOptions | undefined;
	readonly deprecated?: boolean | RuleDeprecatedInfo | undefined;
	readonly replacedBy?: ReadonlyArray<string> | undefined;
}): RuleMeta => {
	const result: RuleMeta = {
		type: opts.type,
		docs: { description: opts.description, ...opts.docs }
	};
	if (opts.fixable !== undefined) result.fixable = opts.fixable;
	if (opts.hasSuggestions !== undefined) {
		result.hasSuggestions = opts.hasSuggestions;
	}
	if (opts.messages !== undefined) result.messages = opts.messages;
	if (opts.schema !== undefined) result.schema = opts.schema;
	if (opts.defaultOptions !== undefined) {
		result.defaultOptions = opts.defaultOptions;
	}
	if (opts.deprecated !== undefined) result.deprecated = opts.deprecated;
	if (opts.replacedBy !== undefined) result.replacedBy = opts.replacedBy;
	return result;
};

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
		name: `ban-${kebabList([obj, ...(P.isString(prop) ? [prop] : prop)])}`,
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
		name: `ban-call-${kebabList(names)}`,
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
 * Create a rule that bans `obj.prop(...)` method-call patterns.
 *
 * Matches `CallExpression` nodes whose callee is a static member expression
 * `obj.prop` where `obj` is an identifier with the given name and `prop`
 * matches one of the given property names.
 *
 * This is the "call of member" counterpart to `banMember` (which bans
 * the bare member access `obj.prop` regardless of whether it's called)
 * and `banCallOf` (which bans bare identifier calls).
 *
 * @example
 * ```ts
 * // Ban `Effect.runSync(...)`
 * Rule.banCallOfMember('Effect', 'runSync', { message: 'Keep effects composable' })
 *
 * // Ban `console.log(...)` and `console.error(...)`
 * Rule.banCallOfMember('console', ['log', 'error'], { message: 'Use Effect.log' })
 * ```
 *
 * @since 0.2.0
 */
export const banCallOfMember = (
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
		name: `ban-call-${kebabList([obj, ...(P.isString(prop) ? [prop] : prop)])}`,
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
						Option.flatMap(AST.matchCallOf(obj, prop)),
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
		name: `ban-new-${kebabList(names)}`,
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
						Option.flatMap(AST.calleeIdentifier),
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
		name: `ban-${kebab(nodeType)}`,
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
	/** Member call expressions to ban: `[object, property | properties]` tuples. */
	readonly memberCalls?:
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
					? Arr.map(spec.statements, (nodeType): EffectVisitor => ({
							[nodeType]: report
						}))
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
										Option.flatMap(AST.calleeIdentifier),
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
					? Arr.map(spec.members, ([obj, prop]): EffectVisitor => ({
							MemberExpression: (node: ESTree.Node) =>
								pipe(
									AST.narrow(node, 'MemberExpression'),
									Option.flatMap(AST.matchMember(obj, prop)),
									Option.match({
										onNone: () => Effect.void,
										onSome: (matched) => report(matched)
									})
								)
						}))
					: [];

			// Member-call bans
			const memberCallVisitors: ReadonlyArray<EffectVisitor> =
				spec.memberCalls !== undefined
					? Arr.map(
							spec.memberCalls,
							([obj, prop]): EffectVisitor => ({
								CallExpression: (node: ESTree.Node) =>
									pipe(
										AST.narrow(node, 'CallExpression'),
										Option.flatMap(
											AST.matchCallOf(obj, prop)
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
					? Arr.map(spec.imports, (source): EffectVisitor => ({
							ImportDeclaration: (node: ESTree.Node) =>
								pipe(
									AST.narrow(node, 'ImportDeclaration'),
									Option.flatMap(AST.matchImport(source)),
									Option.match({
										onNone: () => Effect.void,
										onSome: (matched) => report(matched)
									})
								)
						}))
					: [];

			return mergeVisitors(
				...stmtVisitors,
				...callVisitors,
				...newExprVisitors,
				...memberVisitors,
				...memberCallVisitors,
				...importVisitors
			);
		}
	});
