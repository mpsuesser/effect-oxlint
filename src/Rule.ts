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
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

import { pipe } from 'effect/Function';

import * as AST from './AST.ts';
import { make as makeDiagnostic } from './Diagnostic.ts';
import { fromOxlintContext, RuleContext } from './RuleContext.ts';
import type { EffectVisitor } from './Visitor.ts';
import { toOxlintVisitor } from './Visitor.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration object for `Rule.define`.
 *
 * @since 0.1.0
 */
export interface RuleConfig<Options = void> {
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
	) => Effect.gen.Return<EffectVisitor, never, RuleContext>;
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
export const define = <Options = void>(
	config: RuleConfig<Options>
): CreateRule => ({
	meta: config.meta,
	create(oxlintContext) {
		const ruleCtx = fromOxlintContext(oxlintContext);

		// Runtime boundary: execute effects with RuleContext provided.
		// This is the FFI bridge between oxlint's sync API and Effect.
		const run = <A>(effect: Effect.Effect<A, never, RuleContext>): A =>
			Effect.runSync(Effect.provideService(effect, RuleContext, ruleCtx));

		// Decode options from the raw JSON array
		const decodeOptions = (): Options => {
			const schema = config.options;
			if (schema === undefined) return undefined as Options;
			return Schema.decodeUnknownSync(schema)(oxlintContext.options[0]);
		};
		const options = run(Effect.sync(decodeOptions));

		// Run the create generator to set up Refs and get the visitor map
		const effectVisitor = run(Effect.gen(() => config.create(options)));

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
		name: `ban-${obj}-${Array.isArray(prop) ? prop.join('-') : String(prop)}`,
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
