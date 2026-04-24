# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `exports.types` condition and top-level `types` field in `package.json` so TypeScript tools that don't read conditional exports still pick up type information.
- `Requirements` section in `README.md` documenting that `effect-oxlint` ships TypeScript source (no compiled `dist/`) and listing supported runtimes / bundler configurations.
- Subpath export `effect-oxlint/testing` for the `Testing` module so production bundles don't pull in test-only builders.
- `AST.calleeIdentifier(node)` — unified callee-name extractor accepting both `CallExpression` and `NewExpression`. Replaces the private `newExprCalleeName` helper previously duplicated in `Rule.ts`.
- `Rule.banCallOfMember(obj, prop, opts)` factory and `memberCalls` entry on `BanMultipleSpec` for banning `obj.prop(...)` method-call patterns (e.g. `Effect.runSync`, `console.log`). 6 new unit tests plus a `memberCalls` case on `banMultiple`.
- `SourceCode.getNodeText(node, beforeCount?, afterCount?)` — clear companion to the no-arg `getText()` (whole file), replacing the awkward `Option<Node>` overload.
- "Handler Error Channel" section in `README.md` and expanded JSDoc on `Rule.define` / `EffectHandler` documenting that handlers have a fixed `never` error channel and must catch fallible sub-effects internally.

### Changed

- Bumped `effect` and `@effect/vitest` from `4.0.0-beta.47` to `4.0.0-beta.57` (dependency, peer, override, and README install snippets). All tests and `tsgo` pass without any Effect-code changes.
- `build` and `check` scripts now invoke `bunx --bun vp …` instead of bare `vp …`. The `vp` binary's Node shebang can't load the TypeScript `vite.config.ts`; running it under Bun fixes `bun run check` locally without any CI impact.
- Generated rule names for `banMember` / `banCallOf` / `banNewExpr` / `banStatement` / `banCallOfMember` are now kebab-cased (`ban-throw-statement`, `ban-new-date`, `ban-json-parse-stringify`). The transform is idempotent on already-kebab strings.
- `AST.findAncestor` / `AST.hasAncestor` now carry a literal-type generic so `findAncestor(node, 'FunctionDeclaration')` returns `Option<{ readonly type: 'FunctionDeclaration'; readonly parent?: unknown }>` (mirrors `AST.narrow`).
- `src/Rule.ts` now reuses `AST.calleeIdentifier` instead of a private `newExprCalleeName` duplicate.

### Removed

- `.npmignore` — redundant with the `files` whitelist in `package.json`. `npm pack --dry-run` confirms the tarball still contains only `src/`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `package.json`.
- Flat named re-exports (`ast`, `cwd`, `filename`, `id`, `report`, `sourceCode`, `text`) from the main `effect-oxlint` entrypoint. Use `yield* RuleContext` and the `.filename` / `.report` / etc. fields on the resolved service instead. The named accessors remain on `src/RuleContext.ts` for internal use.
- The `SourceCode.getText(Option<Node>, …)` overload. Call `getText()` for whole-file text or `getNodeText(node, …)` for node-specific text.

### Fixed

- Bun version pinning drift in `AGENTS.md` (`bun@1.3.11` → `bun@1.3.12`, matching `package.json` and CI).
- Added `.references/` to `.gitignore` so local Effect source clones used for skill lookups aren't scanned by `vp check` / linted as project code.

## [0.1.1] — Effect beta.47 compatibility

### Changed

- Aligned package metadata and compatibility with `effect@4.0.0-beta.47`. (#2)

## [0.1.0] — Initial Release

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
