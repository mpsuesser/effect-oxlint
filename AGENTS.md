# AGENTS.md — effect-oxlint

Effect-first library for writing oxlint custom lint rules. Wraps `@oxlint/plugins` in Effect v4 idioms.

## Build / Lint / Test Commands

```sh
bun run check          # lint + format + typecheck (with auto-fix)
bun run test           # vitest run (all tests)
bun run typecheck      # tsgo type-check only
bun run build          # vite-plus build
```

### Running a single test

```sh
bunx vitest run test/Rule.test.ts              # single file
bunx vitest run -t "reports for matching"       # by test name pattern
bunx vitest run test/AST.test.ts -t "matchMember"  # file + name
```

### Verification before submitting

All three must pass:

```sh
bun run check && bun run test && bun run typecheck
```

## Project Structure

```
src/           12 modules — AST, Comment, Diagnostic, Plugin, Rule, RuleContext,
               Scope, SourceCode, Testing, Token, Visitor, index (barrel)
test/          11 test files — one per source module, plus _builders.ts shared helpers
vite.config.ts Lint rules, formatting, test config (vite-plus)
```

Single-package project. Bun is the package manager (`bun@1.3.11`). No monorepo tooling.

## Code Style

### Formatting (enforced by vite-plus)

- Tabs for indentation (width 4), print width 80
- Single quotes, semicolons, no trailing commas
- Arrow parens always: `(x) => ...`
- LF line endings
- JSON files: 2-space indentation

### Imports

1. **Type-only imports first**: `import type { ... } from '...'`
2. **External namespace imports**: `import * as Arr from 'effect/Array'`
3. **Internal imports last**: `import * as AST from './AST.ts'`

Canonical Effect aliases (required):

```ts
import * as Arr from 'effect/Array';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as R from 'effect/Record';
import * as Schema from 'effect/Schema';
import * as Str from 'effect/String';
```

Core combinators from root: `import { Effect, pipe, flow, Match } from 'effect'`
— or from dedicated module: `import * as Effect from 'effect/Effect'`

**All local imports include `.ts` extension**: `'./AST.ts'`, not `'./AST'`.

### File & Naming Conventions

- **Source files**: PascalCase (`Rule.ts`, `SourceCode.ts`, `RuleContext.ts`)
- **Test files**: `<ModuleName>.test.ts` matching source name
- **Functions/variables**: camelCase (`matchMember`, `fromOxlintContext`)
- **Types/interfaces/classes**: PascalCase (`RuleConfig`, `EffectVisitor`)
- **Service keys**: namespaced strings (`'effect-oxlint/RuleContext'`)

### Module Structure

Every source file follows this layout:

1. Module-level JSDoc with `@since` tag
2. Imports (ordered as above)
3. Sections separated by `// ---...--- // Section Name // ---...---`
4. Exported functions with JSDoc (`@since`, `@example`)
5. Internal helpers marked `/** @internal */`

### Types

- `readonly` on all interface fields and function parameters
- `ReadonlyArray<T>` instead of `T[]`
- No `any`, no `@ts-ignore`, no non-null assertions (`!`)
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled
- Use `| undefined` explicitly for optional properties

### Effect Patterns

- **Option for absence**: Convert nullable values with `Option.fromNullishOr` at boundaries. Chain with `Option.map`, `Option.flatMap`, `Option.match`. Never use `Option.getOrThrow`.
- **Dual API**: Public combinators support data-first and data-last via `dual`:
  ```ts
  export const matchMember: {
      (obj: string, props: string[]): (node: ESTree.Node) => Option<...>;
      (node: ESTree.Node, obj: string, props: string[]): Option<...>;
  } = dual(3, (node, obj, props) => { ... });
  ```
- **Effect.gen with function\***: For effectful setup and complex combinators
- **Effect.runSync only at runtime boundaries**: The FFI bridge in `Rule.ts` and test harnesses
- **Ref for mutable state**: `Ref.make` / `Ref.update` in effectful contexts
- **Effect.void for no-ops**: Not `Effect.succeed(undefined)`
- **pipe for composition**: Especially Option chains and Effect pipelines
- **ServiceMap.Service for services**: With unique namespaced string key

### Effect Module Usage (not native JS)

- `Arr.*` over `Array.prototype.*` — `Arr.map`, `Arr.filter`, `Arr.reduce`, `Arr.contains`, `Arr.match`
- `R.*` over `Object.*` — `R.union`, `R.filter`, `R.map`
- `P.isString`, `P.isObject` over raw `typeof` checks
- `Option` over `null | undefined` in domain code
- No imperative `for` / `for...of` loops in domain code

### Error Handling

- Return `Option.none()` or `Effect.void` for no-op / absent paths
- No `throw` or `try/catch` in domain code (use `Effect.try`, `Effect.tryPromise`)
- Tagged errors via `Schema.TaggedErrorClass` for cross-module failures
- Test files may use `throw` and `try/catch` (lint overrides configured)

### Testing

- Framework: Vitest 4 + `@effect/vitest`
- Import test utilities: `import { describe, expect, test } from '@effect/vitest'`
- Effectful tests: `it.effect('name', () => Effect.gen(function* () { ... }).pipe(Effect.provide(TestLayer)))`
- Pure tests: `test('name', () => { expect(...).toBe(...) })`
- Shared builders in `test/_builders.ts` for mock AST nodes
- Test module `src/Testing.ts` provides `createMockContext`, `runRule`, `expectDiagnostics`
- Section separators between test groups (same `// ---` format as source)

### JSDoc

- Every exported API has JSDoc with `@since 0.1.0`
- Module-level doc block at top of each file with description and `@since`
- `@internal` marks non-public exports
- `@example` with code blocks for key APIs
- `@deprecated` where upstream deprecation exists

### Oxlint-Specific Patterns

- Re-export oxlint types with `Oxlint` prefix to avoid collision: `OxlintPlugin`, `OxlintComment`
- `RuleContext` is a `ServiceMap.Service` wrapping oxlint's context
- `withSourceCode` pattern: `Effect.service(RuleContext).pipe(Effect.map(ctx => fn(ctx.sourceCode)))`
- Visitors are `Record<string, (node: ESTree.Node) => Effect<void>>`
- `toOxlintVisitor` converts Effect visitors to plain oxlint visitors at the boundary

### Lint Rules (from vite.config.ts)

The project dogfoods its own `oxlint-effect` rules. Key enforced rules:

- `effect/throw-in-effect-gen`: **error** — no throwing inside Effect.gen
- `effect/vm-in-wrong-file`: **error** — view models in correct files
- `effect/no-opaque-instance-fields`: **error** — no opaque instance fields
- `@typescript-eslint/no-explicit-any`: **error**
- `@typescript-eslint/no-non-null-assertion`: **error**
- ~50 additional `effect/*` rules at `warn` level (prefer-option-over-null, avoid-native-fetch, prefer-match-over-switch, etc.)

Test file overrides: `avoid-untagged-errors` and `avoid-try-catch` disabled.
