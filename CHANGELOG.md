# Changelog

## Unreleased

- align package metadata and docs with `effect@4.0.0-beta.47`

## 0.1.0 — Initial Release

Effect-first library for writing oxlint custom lint rules.

### Modules

#### Rule

Core rule builder and convenience factories.

- `define` — write `create` as an Effect generator with `Ref` state, `Schema`-decoded options, and typed visitors
- `meta` — build `RuleMeta` with sensible defaults
- `banMember` — ban `obj.prop` member expression access
- `banImport` — ban imports matching a source string or predicate
- `banCallOf` — ban bare identifier call expressions
- `banNewExpr` — ban `new` expressions with given callee names
- `banStatement` — ban a specific statement type
- `banMultiple` — combine call, new-expr, member, import, and statement bans into one rule

#### Visitor

Composable visitor construction.

- `on` / `onExit` — single-entry visitor for enter/exit phases
- `merge` — combine multiple visitors (same-key handlers run sequentially)
- `tracked` — enter/exit `Ref<number>` counter replacing mutable `let depth = 0`
- `filter` — conditionally apply a visitor based on filename predicate (dual API)
- `accumulate` — collect items during traversal, analyze at `Program:exit`

#### AST

`Option`-returning pattern matchers with dual API (data-first and data-last).

- `matchMember` / `isMember` — match `obj.prop` member expressions
- `matchCallOf` / `isCallOf` — match `obj.prop(...)` call expressions
- `matchImport` / `isImport` — match import declarations by source
- `calleeName` / `memberNames` / `importSource` — identifier extraction
- `objectKeys` / `objectHasKey` / `objectGetValue` — object expression helpers
- `narrow` — safe node type narrowing to `Option`
- `memberPath` — extract full member chain `a.b.c` → `['a', 'b', 'c']`
- `findAncestor` / `hasAncestor` — parent chain walking (dual API)

#### Diagnostic

Structured diagnostic construction and composable autofixes.

- `make` / `fromId` — diagnostic constructors
- `withFix` / `withSuggestions` — attach fixes/suggestions (dual API)
- `replaceText` / `insertBefore` / `insertAfter` / `removeFix` — fix operations
- `composeFixes` — compose multiple fix functions into one

#### RuleContext

Effect service wrapping the oxlint rule context.

- `RuleContext` — `ServiceMap.Service` with `report`, `id`, `filename`, `cwd`, `options`, `sourceCode`, `languageOptions`, `settings`
- Convenience accessors: `id`, `filename`, `cwd`, `sourceCode`, `text`, `ast`, `report`

#### SourceCode

Effectful queries over tokens, comments, scope, and source text.

- 25 wrapped methods returning `Effect<T, never, RuleContext>` with `Option` for nullable results

#### Scope

Variable lookup and reference analysis with `Option`.

- `findVariable` / `findVariableUp` — scope-chain lookup (dual API)
- `isUsed` / `isWritten` / `isReadOnly` — variable predicates
- `getReferences` / `getReadReferences` / `getWriteReferences` — reference filtering
- `upper` / `childScopes` / `variables` / `throughReferences` / `isStrict` — scope navigation

#### Plugin

Plugin definition and composition.

- `define` — create a typed oxlint plugin from a name and rule map
- `merge` — merge multiple plugins into one

#### Comment

Comment type predicates.

- `isLine` / `isBlock` / `isShebang` / `text`
- `isJSDoc` / `isDisableDirective` / `isEnableDirective`

#### Token

Token type predicates with dual API for `isKeyword` and `isPunctuator`.

- `isKeyword` / `isPunctuator` — dual API (data-first and data-last)
- `isIdentifier` / `isString` / `isNumeric` / `isBoolean` / `isNull` / `isTemplate` / `isRegularExpression` / `isPrivateIdentifier`
- `value` / `type` — accessors

#### Testing

Mock builders, rule runners, and assertion helpers.

- 50+ AST node builders (`id`, `memberExpr`, `callExpr`, `importDecl`, `throwStmt`, `classDecl`, etc.)
- `createMockContext` / `mockRuleContextLayer` / `withMockRuleContext` — mock context factories
- `runRule` / `runRuleMulti` — run rules against visitor events and collect diagnostics
- `messages` / `messageIds` — diagnostic accessors returning `Option`
- `expectDiagnostics` / `expectNoDiagnostics` — assertion helpers

#### Type Re-exports

All `@oxlint/plugins` types re-exported with `Oxlint` prefix where needed (`ESTree`, `OxlintPlugin`, `OxlintComment`, `OxlintToken`, etc.) so consumers don't need a direct dependency for type imports.
