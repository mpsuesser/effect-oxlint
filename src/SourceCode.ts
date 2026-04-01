/**
 * Effect-wrapped queries over oxlint's `SourceCode` object.
 *
 * Every method that may return `null` is lifted to `Option`. Methods
 * that return arrays stay as-is (empty array = no results). All
 * functions read from the `RuleContext` service, so they return
 * `Effect<T, never, RuleContext>` and can be `yield*`'d in handlers.
 *
 * @since 0.2.0
 */
import type {
	Comment,
	ESTree,
	LineColumn,
	Range,
	Scope,
	SourceCode as OxlintSourceCode,
	Token,
	Variable
} from '@oxlint/plugins';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import { RuleContext } from './RuleContext.ts';

// ---------------------------------------------------------------------------
// Internal: read sourceCode from RuleContext
// ---------------------------------------------------------------------------

/** @internal */
const withSourceCode = <A>(
	fn: (sc: OxlintSourceCode) => A
): Effect.Effect<A, never, RuleContext> =>
	Effect.service(RuleContext).pipe(Effect.map((ctx) => fn(ctx.sourceCode)));

// ---------------------------------------------------------------------------
// Source text
// ---------------------------------------------------------------------------

/**
 * Get the source text for a node, optionally with surrounding characters.
 *
 * When called with no arguments, returns the entire source text.
 * Pass an `Option<ESTree.Node>` to get text for a specific node.
 *
 * @since 0.2.0
 */
export const getText: {
	(): Effect.Effect<string, never, RuleContext>;
	(
		node: Option.Option<ESTree.Node>,
		beforeCount?: number,
		afterCount?: number
	): Effect.Effect<string, never, RuleContext>;
} = (
	node?: Option.Option<ESTree.Node>,
	beforeCount?: number,
	afterCount?: number
): Effect.Effect<string, never, RuleContext> =>
	withSourceCode((sc) =>
		sc.getText(
			node === undefined
				? null
				: Option.getOrElse(node, () => null as never),
			beforeCount,
			afterCount
		)
	);

// ---------------------------------------------------------------------------
// Ancestry
// ---------------------------------------------------------------------------

/**
 * Get the ancestor nodes of the given node, from innermost to outermost.
 *
 * Note: oxlint types `getAncestors` as returning `Node[]` where `Node`
 * is the base `Span` interface. At runtime these are full `ESTree.Node`
 * values — the cast bridges this upstream type gap at the FFI boundary.
 *
 * @since 0.2.0
 */
export const getAncestors = (
	node: ESTree.Node
): Effect.Effect<ReadonlyArray<ESTree.Node>, never, RuleContext> =>
	withSourceCode(
		// oxlint-ignore(casting-awareness,avoid-any): FFI boundary —
		// oxlint's `Node` (Span) is structurally narrower than `ESTree.Node`
		// but the runtime values are full ESTree nodes.
		(sc) => sc.getAncestors(node) as unknown as ReadonlyArray<ESTree.Node>
	);

// ---------------------------------------------------------------------------
// Location / Range
// ---------------------------------------------------------------------------

/**
 * Get the AST node that contains the given source offset.
 *
 * Returns `Option.none()` when no node spans that offset.
 *
 * @since 0.2.0
 */
export const getNodeByRangeIndex = (
	offset: number
): Effect.Effect<Option.Option<ESTree.Node>, never, RuleContext> =>
	withSourceCode((sc) =>
		Option.fromNullishOr(sc.getNodeByRangeIndex(offset))
	);

/**
 * Convert a source offset (0-based) to a `{ line, column }` location.
 *
 * @since 0.2.0
 */
export const getLocFromIndex = (
	offset: number
): Effect.Effect<LineColumn, never, RuleContext> =>
	withSourceCode((sc) => sc.getLocFromIndex(offset));

/**
 * Convert a `{ line, column }` location to a source offset (0-based).
 *
 * @since 0.2.0
 */
export const getIndexFromLoc = (
	loc: LineColumn
): Effect.Effect<number, never, RuleContext> =>
	withSourceCode((sc) => sc.getIndexFromLoc(loc));

/**
 * Get the range `[start, end]` for a node or token.
 *
 * @since 0.2.0
 */
export const getRange = (
	nodeOrToken: ESTree.Node | Token | Comment
): Effect.Effect<Range, never, RuleContext> =>
	withSourceCode((sc) => sc.getRange(nodeOrToken));

// ---------------------------------------------------------------------------
// Token queries (single node)
// ---------------------------------------------------------------------------

/**
 * Get the first token of a node.
 *
 * @since 0.2.0
 */
export const getFirstToken = (
	node: ESTree.Node
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) => Option.fromNullishOr(sc.getFirstToken(node)));

/**
 * Get the last token of a node.
 *
 * @since 0.2.0
 */
export const getLastToken = (
	node: ESTree.Node
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) => Option.fromNullishOr(sc.getLastToken(node)));

/**
 * Get all tokens for a node.
 *
 * @since 0.2.0
 */
export const getTokens = (
	node: ESTree.Node
): Effect.Effect<ReadonlyArray<Token>, never, RuleContext> =>
	withSourceCode((sc) => sc.getTokens(node));

// ---------------------------------------------------------------------------
// Token queries (before / after)
// ---------------------------------------------------------------------------

/**
 * Get the token before a node or token.
 *
 * @since 0.2.0
 */
export const getTokenBefore = (
	nodeOrToken: ESTree.Node | Token | Comment
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) =>
		Option.fromNullishOr(sc.getTokenBefore(nodeOrToken))
	);

/**
 * Get the token after a node or token.
 *
 * @since 0.2.0
 */
export const getTokenAfter = (
	nodeOrToken: ESTree.Node | Token | Comment
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) => Option.fromNullishOr(sc.getTokenAfter(nodeOrToken)));

/**
 * Get all tokens between two nodes/tokens.
 *
 * @since 0.2.0
 */
export const getTokensBetween = (
	left: ESTree.Node | Token | Comment,
	right: ESTree.Node | Token | Comment
): Effect.Effect<ReadonlyArray<Token>, never, RuleContext> =>
	withSourceCode((sc) => sc.getTokensBetween(left, right));

/**
 * Get the first token between two nodes/tokens.
 *
 * @since 0.2.0
 */
export const getFirstTokenBetween = (
	left: ESTree.Node | Token | Comment,
	right: ESTree.Node | Token | Comment
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) =>
		Option.fromNullishOr(sc.getFirstTokenBetween(left, right))
	);

/**
 * Find a token by its range start offset.
 *
 * @since 0.2.0
 */
export const getTokenByRangeStart = (
	offset: number
): Effect.Effect<Option.Option<Token>, never, RuleContext> =>
	withSourceCode((sc) =>
		Option.fromNullishOr(sc.getTokenByRangeStart(offset))
	);

// ---------------------------------------------------------------------------
// Comment queries
// ---------------------------------------------------------------------------

/**
 * Get all comments in the file.
 *
 * @since 0.2.0
 */
export const getAllComments = (): Effect.Effect<
	ReadonlyArray<Comment>,
	never,
	RuleContext
> => withSourceCode((sc) => sc.getAllComments());

/**
 * Get comments before a node or token.
 *
 * @since 0.2.0
 */
export const getCommentsBefore = (
	nodeOrToken: ESTree.Node | Token | Comment
): Effect.Effect<ReadonlyArray<Comment>, never, RuleContext> =>
	withSourceCode((sc) => sc.getCommentsBefore(nodeOrToken));

/**
 * Get comments after a node or token.
 *
 * @since 0.2.0
 */
export const getCommentsAfter = (
	nodeOrToken: ESTree.Node | Token | Comment
): Effect.Effect<ReadonlyArray<Comment>, never, RuleContext> =>
	withSourceCode((sc) => sc.getCommentsAfter(nodeOrToken));

/**
 * Get comments inside a node.
 *
 * @since 0.2.0
 */
export const getCommentsInside = (
	node: ESTree.Node
): Effect.Effect<ReadonlyArray<Comment>, never, RuleContext> =>
	withSourceCode((sc) => sc.getCommentsInside(node));

/**
 * Check whether comments exist between two nodes/tokens.
 *
 * @since 0.2.0
 */
export const commentsExistBetween = (
	left: ESTree.Node | Token | Comment,
	right: ESTree.Node | Token | Comment
): Effect.Effect<boolean, never, RuleContext> =>
	withSourceCode((sc) => sc.commentsExistBetween(left, right));

/**
 * Get the JSDoc comment for a node.
 *
 * @deprecated Upstream deprecation. Use `getCommentsBefore` instead.
 * @since 0.2.0
 */
export const getJSDocComment = (
	node: ESTree.Node
): Effect.Effect<Option.Option<Comment>, never, RuleContext> =>
	withSourceCode((sc) => Option.fromNullishOr(sc.getJSDocComment(node)));

// ---------------------------------------------------------------------------
// Scope queries (delegated to SourceCode)
// ---------------------------------------------------------------------------

/**
 * Get the scope for a node.
 *
 * @since 0.2.0
 */
export const getScope = (
	node: ESTree.Node
): Effect.Effect<Scope, never, RuleContext> =>
	withSourceCode((sc) => sc.getScope(node));

/**
 * Get declared variables for a node.
 *
 * @since 0.2.0
 */
export const getDeclaredVariables = (
	node: ESTree.Node
): Effect.Effect<ReadonlyArray<Variable>, never, RuleContext> =>
	withSourceCode((sc) => sc.getDeclaredVariables(node));

/**
 * Check whether a node is a global reference.
 *
 * @since 0.2.0
 */
export const isGlobalReference = (
	node: ESTree.Node
): Effect.Effect<boolean, never, RuleContext> =>
	withSourceCode((sc) => sc.isGlobalReference(node));

/**
 * Mark a variable as used in the scope of the given node.
 *
 * @since 0.2.0
 */
export const markVariableAsUsed = (
	name: string,
	refNode?: ESTree.Node
): Effect.Effect<boolean, never, RuleContext> =>
	withSourceCode((sc) => sc.markVariableAsUsed(name, refNode));

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * Check whether there is a space between two nodes/tokens.
 *
 * @since 0.2.0
 */
export const isSpaceBetween = (
	first: ESTree.Node | Token | Comment,
	second: ESTree.Node | Token | Comment
): Effect.Effect<boolean, never, RuleContext> =>
	withSourceCode((sc) => sc.isSpaceBetween(first, second));

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

/**
 * Get all source lines.
 *
 * @since 0.2.0
 */
export const getLines = (): Effect.Effect<
	ReadonlyArray<string>,
	never,
	RuleContext
> => withSourceCode((sc) => sc.getLines());
