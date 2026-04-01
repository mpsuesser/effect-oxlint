/**
 * Token type predicates and helpers for Effect-first lint rules.
 *
 * Provides convenience checks over oxlint's `Token` type (a discriminated
 * union of `BooleanToken`, `IdentifierToken`, `KeywordToken`, etc.).
 *
 * @since 0.2.0
 */
import type { Token } from '@oxlint/plugins';
import { dual } from 'effect/Function';

// ---------------------------------------------------------------------------
// Type predicates
// ---------------------------------------------------------------------------

/**
 * Check whether a token is a keyword with the given value.
 *
 * @example
 * ```ts
 * Token.isKeyword(token, 'const')  // true if keyword "const"
 * Token.isKeyword(token, 'return') // true if keyword "return"
 * ```
 *
 * @since 0.2.0
 */
export const isKeyword: {
	(keyword: string): (token: Token) => boolean;
	(token: Token, keyword: string): boolean;
} = dual(
	2,
	(token: Token, keyword: string): boolean =>
		token.type === 'Keyword' && token.value === keyword
);

/**
 * Check whether a token is a punctuator with the given value.
 *
 * @example
 * ```ts
 * Token.isPunctuator(token, '{')  // true if punctuator "{"
 * Token.isPunctuator(token, ';')  // true if punctuator ";"
 * ```
 *
 * @since 0.2.0
 */
export const isPunctuator: {
	(value: string): (token: Token) => boolean;
	(token: Token, value: string): boolean;
} = dual(
	2,
	(token: Token, value: string): boolean =>
		token.type === 'Punctuator' && token.value === value
);

/**
 * Check whether a token is an identifier.
 *
 * @since 0.2.0
 */
export const isIdentifier = (token: Token): boolean =>
	token.type === 'Identifier';

/**
 * Check whether a token is a string literal.
 *
 * @since 0.2.0
 */
export const isString = (token: Token): boolean => token.type === 'String';

/**
 * Check whether a token is a numeric literal.
 *
 * @since 0.2.0
 */
export const isNumeric = (token: Token): boolean => token.type === 'Numeric';

/**
 * Check whether a token is a boolean literal.
 *
 * @since 0.2.0
 */
export const isBoolean = (token: Token): boolean => token.type === 'Boolean';

/**
 * Check whether a token is a null literal.
 *
 * @since 0.2.0
 */
export const isNull = (token: Token): boolean => token.type === 'Null';

/**
 * Check whether a token is a template literal part.
 *
 * @since 0.2.0
 */
export const isTemplate = (token: Token): boolean => token.type === 'Template';

/**
 * Check whether a token is a regular expression literal.
 *
 * @since 0.2.0
 */
export const isRegularExpression = (token: Token): boolean =>
	token.type === 'RegularExpression';

/**
 * Check whether a token is a private identifier (e.g. `#foo`).
 *
 * @since 0.2.0
 */
export const isPrivateIdentifier = (token: Token): boolean =>
	token.type === 'PrivateIdentifier';

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Get the string value of a token.
 *
 * @since 0.2.0
 */
export const value = (token: Token): string => token.value;

/**
 * Get the type discriminant of a token.
 *
 * @since 0.2.0
 */
export const type = (token: Token): string => token.type;
