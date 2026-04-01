/**
 * Effect-first library for writing oxlint custom lint rules.
 *
 * @since 0.1.0
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Core modules
// ---------------------------------------------------------------------------

/** AST pattern matching helpers returning `Option` for safe composition. */
export * as AST from './AST.ts';

/** Structured diagnostic construction. */
export * as Diagnostic from './Diagnostic.ts';

/** Plugin definition and composition. */
export * as Plugin from './Plugin.ts';

/** Core rule builder — `Rule.define` is the primary entry point. */
export * as Rule from './Rule.ts';

/** Effect service wrapping the oxlint rule context. */
export { RuleContext } from './RuleContext.ts';
export {
	ast,
	cwd,
	filename,
	id,
	report,
	sourceCode,
	text
} from './RuleContext.ts';

/** Composable visitor construction. */
export * as Visitor from './Visitor.ts';

// ---------------------------------------------------------------------------
// Type re-exports from @oxlint/plugins
// ---------------------------------------------------------------------------

export type {
	Context,
	CreateOnceRule,
	CreateRule,
	ESTree,
	Fix,
	Fixer,
	FixFn,
	Plugin as OxlintPlugin,
	Range,
	Ranged,
	Rule as OxlintRule,
	RuleDocs,
	RuleMeta,
	Scope,
	Settings,
	SourceCode,
	Suggestion,
	Token,
	Visitor as OxlintVisitor
} from '@oxlint/plugins';
