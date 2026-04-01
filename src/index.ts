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

/** Comment type predicates and helpers. */
export * as Comment from './Comment.ts';

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

/** Scope analysis helpers with Option. */
export * as Scope from './Scope.ts';

/** Effect-wrapped SourceCode queries with Option. */
export * as SourceCode from './SourceCode.ts';

/** Testing infrastructure — builders, runners, assertion helpers. */
export * as Testing from './Testing.ts';

/** Token type predicates and helpers. */
export * as Token from './Token.ts';

/** Composable visitor construction. */
export * as Visitor from './Visitor.ts';

// ---------------------------------------------------------------------------
// Type re-exports from @oxlint/plugins
// ---------------------------------------------------------------------------

export type {
	Comment as OxlintComment,
	Context,
	CreateOnceRule,
	CreateRule,
	Definition,
	DefinitionType,
	ESTree,
	Fix,
	Fixer,
	FixFn,
	LineColumn,
	Location,
	Plugin as OxlintPlugin,
	Range,
	Ranged,
	Reference,
	Rule as OxlintRule,
	RuleDocs,
	RuleMeta,
	Scope as OxlintScope,
	ScopeManager,
	ScopeType,
	Settings,
	SourceCode as OxlintSourceCode,
	Span,
	Suggestion,
	Token as OxlintToken,
	Variable,
	Visitor as OxlintVisitor
} from '@oxlint/plugins';
