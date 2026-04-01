/**
 * AST pattern matching helpers returning `Option` for safe composition.
 *
 * Every matcher receives a raw ESTree node and returns `Option<NarrowedType>`
 * so callers can chain with `Option.map`, `Option.flatMap`, etc.
 *
 * @since 0.1.0
 */
import type { ESTree } from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import { dual, pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as Result from 'effect/Result';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** @internal */
const isIdentifier = (
	node: unknown
): node is ESTree.IdentifierName | ESTree.IdentifierReference =>
	P.isObject(node) &&
	'type' in node &&
	node.type === 'Identifier' &&
	'name' in node &&
	P.isString(node.name);

/** @internal */
const identifierName = (node: unknown): Option.Option<string> =>
	isIdentifier(node) ? Option.some(node.name) : Option.none();

// ---------------------------------------------------------------------------
// Member expression matching
// ---------------------------------------------------------------------------

/**
 * Match a `MemberExpression` of the form `obj.prop` where `obj` is an
 * identifier with the given name and `prop` matches one of the given
 * property names.
 *
 * @example
 * ```ts
 * // Match JSON.parse or JSON.stringify
 * AST.matchMember(node, 'JSON', ['parse', 'stringify'])
 * ```
 *
 * @since 0.1.0
 */
export const matchMember: {
	(
		obj: string,
		prop: string | ReadonlyArray<string>
	): (
		node: ESTree.MemberExpression
	) => Option.Option<ESTree.StaticMemberExpression>;
	(
		node: ESTree.MemberExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): Option.Option<ESTree.StaticMemberExpression>;
} = dual(
	3,
	(
		node: ESTree.MemberExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): Option.Option<ESTree.StaticMemberExpression> => {
		if (node.computed) return Option.none();
		const props = P.isString(prop) ? [prop] : prop;
		return pipe(
			identifierName(node.object),
			Option.filter((name) => name === obj),
			Option.flatMap(() => identifierName(node.property)),
			Option.filter((name) => Arr.contains(props, name)),
			Option.map(() => node as ESTree.StaticMemberExpression)
		);
	}
);

/**
 * Check whether a `MemberExpression` is `obj.prop`.
 *
 * Pure boolean predicate — use `matchMember` when you need the narrowed node.
 *
 * @since 0.1.0
 */
export const isMember: {
	(
		obj: string,
		prop: string | ReadonlyArray<string>
	): (node: ESTree.MemberExpression) => boolean;
	(
		node: ESTree.MemberExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): boolean;
} = dual(
	3,
	(
		node: ESTree.MemberExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): boolean => Option.isSome(matchMember(node, obj, prop))
);

// ---------------------------------------------------------------------------
// Call expression matching
// ---------------------------------------------------------------------------

/**
 * Match a `CallExpression` whose callee is `obj.prop(...)`.
 *
 * Returns the call expression narrowed to confirm its callee is a
 * static member expression.
 *
 * @example
 * ```ts
 * AST.matchCallOf(node, 'Effect', 'gen')
 * AST.matchCallOf(node, 'Effect', ['fn', 'fnUntraced'])
 * ```
 *
 * @since 0.1.0
 */
export const matchCallOf: {
	(
		obj: string,
		prop: string | ReadonlyArray<string>
	): (node: ESTree.CallExpression) => Option.Option<ESTree.CallExpression>;
	(
		node: ESTree.CallExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): Option.Option<ESTree.CallExpression>;
} = dual(
	3,
	(
		node: ESTree.CallExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): Option.Option<ESTree.CallExpression> =>
		node.callee.type === 'MemberExpression'
			? pipe(
					matchMember(node.callee, obj, prop),
					Option.map(() => node)
				)
			: Option.none()
);

/**
 * Boolean predicate: is this `CallExpression` a call of `obj.prop(...)`?
 *
 * @since 0.1.0
 */
export const isCallOf: {
	(
		obj: string,
		prop: string | ReadonlyArray<string>
	): (node: ESTree.CallExpression) => boolean;
	(
		node: ESTree.CallExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): boolean;
} = dual(
	3,
	(
		node: ESTree.CallExpression,
		obj: string,
		prop: string | ReadonlyArray<string>
	): boolean => Option.isSome(matchCallOf(node, obj, prop))
);

// ---------------------------------------------------------------------------
// Import matching
// ---------------------------------------------------------------------------

/**
 * Match an `ImportDeclaration` whose source matches a string or predicate.
 *
 * @example
 * ```ts
 * AST.matchImport(node, 'node:fs')
 * AST.matchImport(node, (src) => src.startsWith('node:'))
 * ```
 *
 * @since 0.1.0
 */
export const matchImport: {
	(
		source: string | ((source: string) => boolean)
	): (
		node: ESTree.ImportDeclaration
	) => Option.Option<ESTree.ImportDeclaration>;
	(
		node: ESTree.ImportDeclaration,
		source: string | ((source: string) => boolean)
	): Option.Option<ESTree.ImportDeclaration>;
} = dual(
	2,
	(
		node: ESTree.ImportDeclaration,
		source: string | ((source: string) => boolean)
	): Option.Option<ESTree.ImportDeclaration> => {
		const src = node.source.value;
		const matches = P.isString(source) ? src === source : source(src);
		return matches ? Option.some(node) : Option.none();
	}
);

/**
 * Boolean predicate: does this `ImportDeclaration` import from the given source?
 *
 * @since 0.1.0
 */
export const isImport: {
	(
		source: string | ((source: string) => boolean)
	): (node: ESTree.ImportDeclaration) => boolean;
	(
		node: ESTree.ImportDeclaration,
		source: string | ((source: string) => boolean)
	): boolean;
} = dual(
	2,
	(
		node: ESTree.ImportDeclaration,
		source: string | ((source: string) => boolean)
	): boolean => Option.isSome(matchImport(node, source))
);

// ---------------------------------------------------------------------------
// Identifier extraction
// ---------------------------------------------------------------------------

/**
 * Extract the callee name from a `CallExpression` when the callee is a
 * bare identifier (e.g. `fetch(...)`).
 *
 * @since 0.1.0
 */
export const calleeName = (
	node: ESTree.CallExpression
): Option.Option<string> => identifierName(node.callee);

/**
 * Extract the object and property names from a static `MemberExpression`.
 *
 * Returns `Option<readonly [objectName, propertyName]>`.
 *
 * @since 0.1.0
 */
export const memberNames = (
	node: ESTree.MemberExpression
): Option.Option<readonly [obj: string, prop: string]> =>
	node.computed
		? Option.none()
		: pipe(
				identifierName(node.object),
				Option.flatMap((obj) =>
					pipe(
						identifierName(node.property),
						Option.map((prop) => [obj, prop] as const)
					)
				)
			);

/**
 * Extract the import source string from an `ImportDeclaration`.
 *
 * @since 0.1.0
 */
export const importSource = (node: ESTree.ImportDeclaration): string =>
	node.source.value;

// ---------------------------------------------------------------------------
// Object expression helpers
// ---------------------------------------------------------------------------

/**
 * Collect the statically-known key names from an `ObjectExpression`.
 *
 * Spread elements and computed properties are ignored.
 *
 * @since 0.1.0
 */
export const objectKeys = (
	node: ESTree.ObjectExpression
): ReadonlyArray<string> =>
	pipe(
		node.properties,
		Arr.filterMap((p) => {
			if (p.type !== 'Property') return Result.fail(undefined);
			return pipe(
				identifierName(p.key),
				Option.orElse(() =>
					p.key.type === 'Literal' && P.isString(p.key.value)
						? Option.some(p.key.value)
						: Option.none()
				),
				Result.fromOption(() => undefined)
			);
		})
	);

/**
 * Check whether an `ObjectExpression` has a property with the given key.
 *
 * @since 0.1.0
 */
export const objectHasKey: {
	(key: string): (node: ESTree.ObjectExpression) => boolean;
	(node: ESTree.ObjectExpression, key: string): boolean;
} = dual(2, (node: ESTree.ObjectExpression, key: string): boolean =>
	Arr.contains(objectKeys(node), key)
);

/**
 * Get the value expression for a given key in an `ObjectExpression`.
 *
 * @since 0.1.0
 */
export const objectGetValue: {
	(
		key: string
	): (node: ESTree.ObjectExpression) => Option.Option<ESTree.Expression>;
	(
		node: ESTree.ObjectExpression,
		key: string
	): Option.Option<ESTree.Expression>;
} = dual(
	2,
	(
		node: ESTree.ObjectExpression,
		key: string
	): Option.Option<ESTree.Expression> =>
		pipe(
			node.properties,
			Arr.findFirst(
				(p): p is ESTree.ObjectProperty =>
					p.type === 'Property' &&
					(identifierName(p.key).pipe(
						Option.map((n) => n === key),
						Option.getOrElse(() => false)
					) ||
						(p.key.type === 'Literal' && p.key.value === key))
			),
			Option.map((p) => p.value)
		)
);

// ---------------------------------------------------------------------------
// Ancestor / parent helpers
// ---------------------------------------------------------------------------

/** @internal Type guard for objects with a string `type` and optional `parent`. */
const isASTShape = (
	value: unknown
): value is { readonly type: string; readonly parent?: unknown } =>
	P.isObject(value) && 'type' in value && P.isString(value.type);

/**
 * Walk the `.parent` chain and return the first ancestor whose `type`
 * matches the given string.
 *
 * Returns the ancestor as an opaque record — callers should narrow
 * via `type` checks or other AST helpers rather than casting.
 *
 * @since 0.1.0
 */
export const findAncestor = (
	node: { readonly parent?: unknown },
	type: string
): Option.Option<{ readonly type: string; readonly parent?: unknown }> => {
	let current: unknown = node.parent;
	while (isASTShape(current)) {
		if (current.type === type) return Option.some(current);
		current = current.parent;
	}
	return Option.none();
};

/**
 * Check whether any ancestor of the node has the given `type`.
 *
 * @since 0.1.0
 */
export const hasAncestor = (
	node: { readonly parent?: unknown },
	type: string
): boolean => Option.isSome(findAncestor(node, type));
