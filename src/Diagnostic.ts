/**
 * Structured diagnostic construction for Effect-first lint rules.
 *
 * Wraps the oxlint `Diagnostic` type with builder helpers.
 *
 * @since 0.1.0
 */
import type {
	Diagnostic as OxlintDiagnostic,
	DiagnosticData,
	Fix as OxlintFix,
	FixFn,
	Ranged,
	Suggestion
} from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import { dual } from 'effect/Function';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as Result from 'effect/Result';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

/**
 * The raw oxlint diagnostic type.
 *
 * @since 0.1.0
 */
export type { OxlintDiagnostic as Diagnostic };

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Create a diagnostic with a message and node location.
 *
 * @since 0.1.0
 */
export const make = (opts: {
	readonly node: Ranged;
	readonly message: string;
	readonly data?: DiagnosticData;
}): OxlintDiagnostic => ({
	node: opts.node,
	message: opts.message,
	data: opts.data
});

/**
 * Create a diagnostic using a `messageId` from `meta.messages`.
 *
 * @since 0.1.0
 */
export const fromId = (opts: {
	readonly node: Ranged;
	readonly messageId: string;
	readonly data?: DiagnosticData;
}): OxlintDiagnostic => ({
	node: opts.node,
	messageId: opts.messageId,
	data: opts.data
});

// ---------------------------------------------------------------------------
// Combinators
// ---------------------------------------------------------------------------

/**
 * Attach an autofix function to a diagnostic.
 *
 * @since 0.1.0
 */
export const withFix: {
	(fix: FixFn): (diagnostic: OxlintDiagnostic) => OxlintDiagnostic;
	(diagnostic: OxlintDiagnostic, fix: FixFn): OxlintDiagnostic;
} = dual(
	2,
	(diagnostic: OxlintDiagnostic, fix: FixFn): OxlintDiagnostic => ({
		...diagnostic,
		fix
	})
);

/**
 * Attach suggestion fixes to a diagnostic.
 *
 * @since 0.1.0
 */
export const withSuggestions: {
	(
		suggestions: ReadonlyArray<Suggestion>
	): (diagnostic: OxlintDiagnostic) => OxlintDiagnostic;
	(
		diagnostic: OxlintDiagnostic,
		suggestions: ReadonlyArray<Suggestion>
	): OxlintDiagnostic;
} = dual(
	2,
	(
		diagnostic: OxlintDiagnostic,
		suggestions: ReadonlyArray<Suggestion>
	): OxlintDiagnostic => ({
		...diagnostic,
		suggest: Array.from(suggestions)
	})
);

// ---------------------------------------------------------------------------
// Fix helpers
// ---------------------------------------------------------------------------

/**
 * Composable fix operations.
 *
 * Each function returns a `FixFn` that can be passed to `withFix`
 * or composed via `composeFixes`.
 *
 * @since 0.1.0
 */

/**
 * Replace the text of a node or token.
 *
 * @since 0.1.0
 */
export const replaceText =
	(nodeOrToken: Ranged, text: string): FixFn =>
	(fixer) =>
		fixer.replaceText(nodeOrToken, text);

/**
 * Insert text before a node or token.
 *
 * @since 0.1.0
 */
export const insertBefore =
	(nodeOrToken: Ranged, text: string): FixFn =>
	(fixer) =>
		fixer.insertTextBefore(nodeOrToken, text);

/**
 * Insert text after a node or token.
 *
 * @since 0.1.0
 */
export const insertAfter =
	(nodeOrToken: Ranged, text: string): FixFn =>
	(fixer) =>
		fixer.insertTextAfter(nodeOrToken, text);

/**
 * Remove a node or token.
 *
 * @since 0.1.0
 */
export const removeFix =
	(nodeOrToken: Ranged): FixFn =>
	(fixer) =>
		fixer.remove(nodeOrToken);

/** @internal Type guard for an oxlint Fix value (has `range` and `text`). */
const isFix = (value: unknown): value is OxlintFix =>
	P.isObject(value) && 'range' in value && 'text' in value;

/**
 * Extract fixes from a single `FixFn` result.
 *
 * The parameter is typed as `unknown` because oxlint's `FixFn` returns
 * a nullable union (`Fix | Array<Fix | null> | IterableIterator<…> | null`).
 * We guard at the boundary instead of mirroring the nullable upstream type.
 *
 * @internal
 */
const extractFixes = (result: unknown): ReadonlyArray<OxlintFix> => {
	if (result === null || result === undefined) return [];
	if (isFix(result)) return [result];
	if (!P.isIterable(result)) return [];
	return Arr.filterMap(Array.from(result), (item) =>
		Option.fromNullishOr(item).pipe(
			Option.filter(isFix),
			Result.fromOption(() => undefined)
		)
	);
};

/**
 * Compose multiple fix functions into one.
 *
 * All individual fixes are collected into a single array result.
 *
 * @since 0.1.0
 */
export const composeFixes =
	(...fixes: ReadonlyArray<FixFn>): FixFn =>
	(fixer) =>
		Arr.flatMap(fixes, (fn) => Array.from(extractFixes(fn(fixer))));
