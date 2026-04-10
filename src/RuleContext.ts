/**
 * Effect service wrapping the oxlint rule context.
 *
 * Provides effectful access to the linting context — file info,
 * source code queries, diagnostics reporting, and rule options.
 *
 * @since 0.1.0
 */
import type {
	Context as OxlintContext,
	Diagnostic as OxlintDiagnostic,
	ESTree,
	LanguageOptions,
	Options,
	Settings,
	SourceCode
} from '@oxlint/plugins';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * The lint rule context, provided as an Effect service.
 *
 * Available inside `Rule.define`'s `create` generator and every
 * visitor handler via `yield* RuleContext`.
 *
 * @since 0.1.0
 */
export class RuleContext extends Context.Service<
	RuleContext,
	{
		/** Report a lint diagnostic for the current file. */
		readonly report: (diagnostic: OxlintDiagnostic) => Effect.Effect<void>;
		/** Rule ID in `plugin/rule` form. */
		readonly id: string;
		/** Absolute path of the file being linted. */
		readonly filename: string;
		/** Current working directory. */
		readonly cwd: string;
		/** Raw rule options (JSON values). */
		readonly options: Readonly<Options>;
		/** Source code access (tokens, comments, text, scope, etc.). */
		readonly sourceCode: SourceCode;
		/** Language / parser options for this file. */
		readonly languageOptions: Readonly<LanguageOptions>;
		/** Shared settings from the oxlint config. */
		readonly settings: Readonly<Settings>;
	}
>()('effect-oxlint/RuleContext') {}

// ---------------------------------------------------------------------------
// Constructor from raw oxlint Context
// ---------------------------------------------------------------------------

/**
 * Build a `RuleContext` value from the raw oxlint `Context`.
 *
 * @internal
 */
export const fromOxlintContext = (ctx: OxlintContext): RuleContext['Service'] =>
	RuleContext.of({
		report: (diagnostic) => Effect.sync(() => ctx.report(diagnostic)),
		id: ctx.id,
		filename: ctx.filename,
		cwd: ctx.cwd,
		options: ctx.options,
		sourceCode: ctx.sourceCode,
		languageOptions: ctx.languageOptions,
		settings: ctx.settings
	});

// ---------------------------------------------------------------------------
// Convenience accessors (yield*-able inside handlers)
// ---------------------------------------------------------------------------

/**
 * Effectful access to the rule ID.
 *
 * @since 0.1.0
 */
export const id: Effect.Effect<string, never, RuleContext> = Effect.service(
	RuleContext
).pipe(Effect.map((ctx) => ctx.id));

/**
 * Effectful access to the filename of the file being linted.
 *
 * @since 0.1.0
 */
export const filename: Effect.Effect<string, never, RuleContext> =
	Effect.service(RuleContext).pipe(Effect.map((ctx) => ctx.filename));

/**
 * Effectful access to the working directory.
 *
 * @since 0.1.0
 */
export const cwd: Effect.Effect<string, never, RuleContext> = Effect.service(
	RuleContext
).pipe(Effect.map((ctx) => ctx.cwd));

/**
 * Effectful access to the SourceCode object.
 *
 * @since 0.1.0
 */
export const sourceCode: Effect.Effect<SourceCode, never, RuleContext> =
	Effect.service(RuleContext).pipe(Effect.map((ctx) => ctx.sourceCode));

/**
 * Effectful access to the raw source text.
 *
 * @since 0.1.0
 */
export const text: Effect.Effect<string, never, RuleContext> = Effect.service(
	RuleContext
).pipe(Effect.map((ctx) => ctx.sourceCode.text));

/**
 * Effectful access to the AST root node.
 *
 * @since 0.1.0
 */
export const ast: Effect.Effect<ESTree.Program, never, RuleContext> =
	Effect.service(RuleContext).pipe(Effect.map((ctx) => ctx.sourceCode.ast));

/**
 * Report a lint diagnostic.
 *
 * Shorthand so handlers can `yield* RuleContext.report(diagnostic)`
 * without first resolving the full service.
 *
 * @since 0.1.0
 */
export const report = (
	diagnostic: OxlintDiagnostic
): Effect.Effect<void, never, RuleContext> =>
	Effect.service(RuleContext).pipe(
		Effect.flatMap((ctx) => ctx.report(diagnostic))
	);
