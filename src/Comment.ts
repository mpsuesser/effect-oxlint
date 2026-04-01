/**
 * Comment type predicates and helpers for Effect-first lint rules.
 *
 * Oxlint comments have a `type` of `"Line"`, `"Block"`, or `"Shebang"`
 * and a `value` string (the comment text without delimiters).
 *
 * @since 0.2.0
 */
import type { Comment } from '@oxlint/plugins';
import * as Str from 'effect/String';

// ---------------------------------------------------------------------------
// Type predicates
// ---------------------------------------------------------------------------

/**
 * Check whether a comment is a line comment (`// ...`).
 *
 * @since 0.2.0
 */
export const isLine = (comment: Comment): boolean => comment.type === 'Line';

/**
 * Check whether a comment is a block comment (`/* ... *​/`).
 *
 * @since 0.2.0
 */
export const isBlock = (comment: Comment): boolean => comment.type === 'Block';

/**
 * Check whether a comment is a shebang (`#!/usr/bin/env node`).
 *
 * @since 0.2.0
 */
export const isShebang = (comment: Comment): boolean =>
	comment.type === 'Shebang';

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/**
 * Get the text content of a comment (without delimiters).
 *
 * @since 0.2.0
 */
export const text = (comment: Comment): string => comment.value;

/**
 * Check whether a comment is a JSDoc comment (`/** ... *​/`).
 *
 * A JSDoc comment is a block comment whose value starts with `*`.
 *
 * @since 0.2.0
 */
export const isJSDoc = (comment: Comment): boolean =>
	comment.type === 'Block' && Str.startsWith('*')(comment.value);

/**
 * Check whether a comment is an eslint/oxlint disable directive.
 *
 * Matches line comments like `// eslint-disable-next-line ...`
 * and block comments like `/* eslint-disable ... *​/`.
 *
 * @since 0.2.0
 */
export const isDisableDirective = (comment: Comment): boolean => {
	const trimmed = Str.trim(comment.value);
	return (
		Str.startsWith('eslint-disable')(trimmed) ||
		Str.startsWith('oxlint-disable')(trimmed)
	);
};

/**
 * Check whether a comment is an eslint/oxlint enable directive.
 *
 * @since 0.2.0
 */
export const isEnableDirective = (comment: Comment): boolean => {
	const trimmed = Str.trim(comment.value);
	return (
		Str.startsWith('eslint-enable')(trimmed) ||
		Str.startsWith('oxlint-enable')(trimmed)
	);
};
