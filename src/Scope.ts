/**
 * Scope analysis helpers for Effect-first lint rules.
 *
 * Wraps oxlint's scope manager types (`Scope`, `Variable`, `Reference`,
 * `Definition`) with `Option`-returning lookups and convenience predicates.
 *
 * For scope queries that require `SourceCode` access (e.g. `getScope`,
 * `getDeclaredVariables`), see the `SourceCode` module which provides
 * effectful wrappers.
 *
 * @since 0.2.0
 */
import type {
	Reference,
	Scope as OxlintScope,
	Variable
} from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import { dual, pipe } from 'effect/Function';
import * as Option from 'effect/Option';

// ---------------------------------------------------------------------------
// Variable lookup
// ---------------------------------------------------------------------------

/**
 * Find a variable by name in a scope.
 *
 * Searches the scope's `set` (a `Map<string, Variable>`).
 *
 * @since 0.2.0
 */
export const findVariable: {
	(name: string): (scope: OxlintScope) => Option.Option<Variable>;
	(scope: OxlintScope, name: string): Option.Option<Variable>;
} = dual(
	2,
	(scope: OxlintScope, name: string): Option.Option<Variable> =>
		Option.fromNullishOr(scope.set.get(name))
);

/**
 * Find a variable by name, walking up the scope chain.
 *
 * Starts at the given scope and checks each `upper` scope until found
 * or the global scope is exhausted.
 *
 * @since 0.2.0
 */
export const findVariableUp: {
	(name: string): (scope: OxlintScope) => Option.Option<Variable>;
	(scope: OxlintScope, name: string): Option.Option<Variable>;
} = dual(2, (scope: OxlintScope, name: string): Option.Option<Variable> => {
	const walk = (current: OxlintScope): Option.Option<Variable> =>
		pipe(
			Option.fromNullishOr(current.set.get(name)),
			Option.orElse(() =>
				pipe(
					Option.fromNullishOr(current.upper),
					Option.flatMap((parent) => walk(parent))
				)
			)
		);
	return walk(scope);
});

// ---------------------------------------------------------------------------
// Variable predicates
// ---------------------------------------------------------------------------

/**
 * Check whether a variable has any read references.
 *
 * A variable is considered "used" if at least one reference reads it.
 *
 * @since 0.2.0
 */
export const isUsed = (variable: Variable): boolean =>
	Arr.some(variable.references, (ref) => ref.isRead());

/**
 * Check whether a variable has any write references.
 *
 * @since 0.2.0
 */
export const isWritten = (variable: Variable): boolean =>
	Arr.some(variable.references, (ref) => ref.isWrite());

/**
 * Check whether a variable is only read (no writes).
 *
 * @since 0.2.0
 */
export const isReadOnly = (variable: Variable): boolean =>
	Arr.some(variable.references, (ref) => ref.isReadOnly());

// ---------------------------------------------------------------------------
// Reference helpers
// ---------------------------------------------------------------------------

/**
 * Get all references for a variable.
 *
 * @since 0.2.0
 */
export const getReferences = (variable: Variable): ReadonlyArray<Reference> =>
	variable.references;

/**
 * Get the read references for a variable.
 *
 * @since 0.2.0
 */
export const getReadReferences = (
	variable: Variable
): ReadonlyArray<Reference> =>
	pipe(
		variable.references,
		Arr.filter((ref) => ref.isRead())
	);

/**
 * Get the write references for a variable.
 *
 * @since 0.2.0
 */
export const getWriteReferences = (
	variable: Variable
): ReadonlyArray<Reference> =>
	pipe(
		variable.references,
		Arr.filter((ref) => ref.isWrite())
	);

// ---------------------------------------------------------------------------
// Scope navigation
// ---------------------------------------------------------------------------

/**
 * Get the parent (upper) scope.
 *
 * @since 0.2.0
 */
export const upper = (scope: OxlintScope): Option.Option<OxlintScope> =>
	Option.fromNullishOr(scope.upper);

/**
 * Get the child scopes.
 *
 * @since 0.2.0
 */
export const childScopes = (scope: OxlintScope): ReadonlyArray<OxlintScope> =>
	scope.childScopes;

/**
 * Get all variables in a scope.
 *
 * @since 0.2.0
 */
export const variables = (scope: OxlintScope): ReadonlyArray<Variable> =>
	scope.variables;

/**
 * Get "through" references (unresolved in this scope).
 *
 * @since 0.2.0
 */
export const throughReferences = (
	scope: OxlintScope
): ReadonlyArray<Reference> => scope.through;

/**
 * Check whether a scope is strict mode.
 *
 * @since 0.2.0
 */
export const isStrict = (scope: OxlintScope): boolean => scope.isStrict;
