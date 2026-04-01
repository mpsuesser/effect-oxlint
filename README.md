# effect-oxlint

Write [oxlint](https://oxc.rs/docs/guide/usage/linter) custom lint rules with [Effect v4](https://effect.website).

`effect-oxlint` wraps `@oxlint/plugins` in Effect idioms so rule authors get typed errors, composable visitors, `Option`-safe AST matching, and `Ref`-based state without any mutable variables.

## Features

- **`Rule.define`** — write `create` as an Effect generator; use `yield*` for state, context, and diagnostics
- **`Visitor.*`** — composable visitor combinators: `on`, `onExit`, `merge`, `tracked`, `filter`, `accumulate`
- **`AST.*`** — `Option`-returning matchers with dual API (data-first and data-last): `matchMember`, `matchCallOf`, `matchImport`, `narrow`, `memberPath`
- **`Diagnostic.*`** — structured diagnostic builders with composable autofixes
- **`SourceCode.*` / `Scope.*`** — effectful queries over tokens, comments, scope, and variables
- **`Testing.*`** — mock builders, rule runners, and assertion helpers for `@effect/vitest`
- **`Plugin.define`** — assemble rules into a plugin that oxlint can load

## Install

```sh
bun add effect-oxlint effect@4.0.0-beta.43
```

`effect-oxlint` has two peer dependencies:

| Package | Version |
| --- | --- |
| `effect` | `4.0.0-beta.43` |
| `@oxlint/plugins` | `^1.57.0` |

## Quick Start

### 1. Define a rule

```ts
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { AST, Diagnostic, Rule, RuleContext, Visitor } from 'effect-oxlint'

const noJsonParse = Rule.define({
  name: 'no-json-parse',
  meta: Rule.meta({
    type: 'suggestion',
    description: 'Use Schema for JSON decoding instead of JSON.parse'
  }),
  create: function* () {
    const ctx = yield* RuleContext
    return {
      MemberExpression: (node) =>
        Option.match(AST.matchMember(node, 'JSON', ['parse', 'stringify']), {
          onNone: () => Effect.void,
          onSome: (matched) =>
            ctx.report(
              Diagnostic.make({ node: matched, message: 'Use Schema for JSON' })
            )
        })
    }
  }
})
```

### 2. Use convenience factories for common patterns

```ts
import { Rule } from 'effect-oxlint'

// Ban a member expression
const noMathRandom = Rule.banMember('Math', 'random', {
  message: 'Use the Effect Random service instead'
})

// Ban an import
const noNodeFs = Rule.banImport('node:fs', {
  message: 'Use the Effect FileSystem service instead'
})

// Ban a statement type
const noThrow = Rule.banStatement('ThrowStatement', {
  message: 'Use Effect.fail instead of throw'
})
```

### 3. Assemble into a plugin

```ts
import { Plugin } from 'effect-oxlint'

export default Plugin.define({
  name: 'my-effect-rules',
  rules: {
    'no-json-parse': noJsonParse,
    'no-math-random': noMathRandom,
    'no-node-fs': noNodeFs,
    'no-throw': noThrow
  }
})
```

## Visitor Combinators

Visitors are `Record<string, (node) => Effect<void>>` maps. The `Visitor` module provides combinators to build and compose them.

### Merge multiple visitors

```ts
import { Visitor } from 'effect-oxlint'

const combined = Visitor.merge(importVisitor, memberVisitor, statementVisitor)
```

When two visitors handle the same node type, both handlers run sequentially.

### Track depth with `Ref`

Replace mutable `let depth = 0` counters with `Visitor.tracked`:

```ts
import * as Ref from 'effect/Ref'
import { AST, Visitor } from 'effect-oxlint'

const depthRef = yield* Ref.make(0)
const tracker = Visitor.tracked(
  'CallExpression',
  (node) => AST.isCallOf(node, 'Effect', 'gen'),
  depthRef
)
// depthRef increments on enter, decrements on exit
```

### Accumulate and analyze

Collect data during traversal, then analyze at `Program:exit`:

```ts
import { Visitor, AST } from 'effect-oxlint'

const visitor = yield* Visitor.accumulate(
  'ExportNamedDeclaration',
  (node) => AST.narrow(node, 'ExportNamedDeclaration'),
  function* (exports) {
    // all exports collected — analyze them here
  }
)
```

### Filter by filename

Restrict a visitor to specific files:

```ts
import { Visitor } from 'effect-oxlint'

const visitor = yield* Visitor.filter(
  (filename) => !filename.endsWith('.test.ts'),
  mainVisitor
)
```

## AST Matching

Every matcher returns `Option` for safe composition with `pipe`, `Option.map`, and `Option.flatMap`. All public matchers support dual API (data-first and data-last).

```ts
import { pipe } from 'effect'
import * as Option from 'effect/Option'
import { AST } from 'effect-oxlint'

// Data-first
AST.matchMember(node, 'JSON', ['parse', 'stringify'])

// Data-last (pipe-friendly)
pipe(node, AST.matchMember('Effect', 'gen'))

// Chain matchers
pipe(
  AST.narrow(node, 'CallExpression'),
  Option.flatMap(AST.matchCallOf('Effect', 'gen'))
)

// Extract member path: a.b.c -> Some(['a', 'b', 'c'])
AST.memberPath(node)

// Match imports by string or predicate
AST.matchImport(node, (src) => src.startsWith('node:'))
```

## Diagnostics and Autofixes

```ts
import { Diagnostic } from 'effect-oxlint'

// Basic diagnostic
const diag = Diagnostic.make({ node, message: 'Avoid this pattern' })

// With autofix
const fixed = Diagnostic.withFix(diag, Diagnostic.replaceText(node, 'replacement'))

// Compose multiple fixes
const multiFix = Diagnostic.composeFixes(
  Diagnostic.insertBefore(node, 'prefix'),
  Diagnostic.insertAfter(node, 'suffix')
)
```

## Testing

`effect-oxlint` ships a `Testing` module with mock AST builders, rule runners, and assertion helpers.

```ts
import { describe, expect, test } from '@effect/vitest'
import * as Arr from 'effect/Array'
import { Rule, Testing } from 'effect-oxlint'

describe('no-json-parse', () => {
  test('reports JSON.parse', () => {
    const diagnostics = Testing.runRule(
      noJsonParse,
      'MemberExpression',
      Testing.Builders.memberExpr('JSON', 'parse')
    )
    Testing.expectDiagnostics(diagnostics, [
      { message: 'Use Schema for JSON' }
    ])
  })

  test('ignores other member expressions', () => {
    const diagnostics = Testing.runRule(
      noJsonParse,
      'MemberExpression',
      Testing.Builders.memberExpr('console', 'log')
    )
    expect(Arr.length(diagnostics)).toBe(0)
  })
})
```

Available builders include `id`, `memberExpr`, `computedMemberExpr`, `chainedMemberExpr`, `callExpr`, `importDecl`, `throwStmt`, `literal`, `objectExpr`, `program`, and more.

## Modules

| Module | Purpose |
| --- | --- |
| `Rule` | Core rule builder (`define`, `meta`, `banMember`, `banImport`, `banStatement`) |
| `Visitor` | Composable visitors (`on`, `onExit`, `merge`, `tracked`, `filter`, `accumulate`) |
| `AST` | `Option`-returning pattern matchers (`matchMember`, `matchCallOf`, `matchImport`, `narrow`, `memberPath`, `findAncestor`) |
| `Diagnostic` | Diagnostic construction and autofix helpers |
| `RuleContext` | Effect service with access to file info, source code, and `report` |
| `SourceCode` | Effectful queries: text, tokens, comments, scope, node location |
| `Scope` | Variable lookup and reference analysis with `Option` |
| `Plugin` | `define` and `merge` for plugin assembly |
| `Comment` | Comment type predicates (`isLine`, `isBlock`, `isJSDoc`, `isDisableDirective`) |
| `Token` | Token type predicates (`isKeyword`, `isPunctuator`, `isIdentifier`, `isString`) |
| `Testing` | Mock builders, `runRule`, `expectDiagnostics` for test harnesses |

## Development

```sh
bun install                # install dependencies
bun run check              # lint + format + typecheck (auto-fix)
bun run test               # run all tests
bun run typecheck          # tsgo type-check only
bun run build              # build

# Single test file
bunx vitest run test/Rule.test.ts

# By test name
bunx vitest run -t "reports for matching"
```

## License

MIT
