# effect-oxlint

[![npm](https://img.shields.io/npm/v/effect-oxlint)](https://www.npmjs.com/package/effect-oxlint)
[![JSR](https://jsr.io/badges/@effect-oxlint/effect-oxlint)](https://jsr.io/@effect-oxlint/effect-oxlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

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
npm install effect-oxlint effect@4.0.0-beta.57
```

```sh
bun add effect-oxlint effect@4.0.0-beta.57
```

```sh
deno add jsr:@effect-oxlint/effect-oxlint
```

## Quick Start

### 1. Define a rule

```ts
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { AST, Diagnostic, Rule, RuleContext } from 'effect-oxlint';

const noJsonParse = Rule.define({
	name: 'no-json-parse',
	meta: Rule.meta({
		type: 'suggestion',
		description: 'Use Schema for JSON decoding instead of JSON.parse'
	}),
	create: function* () {
		const ctx = yield* RuleContext;
		return {
			// node is typed as ESTree.MemberExpression automatically
			MemberExpression: (node) =>
				Option.match(
					AST.matchMember(node, 'JSON', ['parse', 'stringify']),
					{
						onNone: () => Effect.void,
						onSome: (matched) =>
							ctx.report(
								Diagnostic.make({
									node: matched,
									message: 'Use Schema for JSON'
								})
							)
					}
				)
		};
	}
});
```

### 2. Use convenience factories for common patterns

```ts
import { Rule } from 'effect-oxlint';

// Ban a member expression
const noMathRandom = Rule.banMember('Math', 'random', {
	message: 'Use the Effect Random service instead'
});

// Ban an import
const noNodeFs = Rule.banImport('node:fs', {
	message: 'Use the Effect FileSystem service instead'
});

// Ban a statement type
const noThrow = Rule.banStatement('ThrowStatement', {
	message: 'Use Effect.fail instead of throw'
});

// Ban bare identifier calls (e.g. fetch(), useState())
const noFetch = Rule.banCallOf('fetch', {
	message: 'Use Effect HTTP client instead'
});

// Ban new expressions (e.g. new Date(), new Error())
const noNewDate = Rule.banNewExpr('Date', {
	message: 'Use Clock service instead'
});

// Ban multiple patterns with one rule
const noImperativeLoops = Rule.banMultiple(
	{
		statements: [
			'ForStatement',
			'ForInStatement',
			'ForOfStatement',
			'WhileStatement',
			'DoWhileStatement'
		]
	},
	{ message: 'Use Arr.map / Effect.forEach instead' }
);

// Combine different ban types in a single rule
const useClockService = Rule.banMultiple(
	{
		newExprs: 'Date',
		members: [['Date', 'now']]
	},
	{ message: 'Use Clock service' }
);
```

### 3. Assemble into a plugin

```ts
import { Plugin } from 'effect-oxlint';

export default Plugin.define({
	name: 'my-effect-rules',
	rules: {
		'no-json-parse': noJsonParse,
		'no-math-random': noMathRandom,
		'no-node-fs': noNodeFs,
		'no-throw': noThrow
	}
});
```

## Visitor Combinators

Visitors are `Record<string, (node) => Effect<void>>` maps. The `Visitor` module provides combinators to build and compose them.

### Merge multiple visitors

```ts
import { Visitor } from 'effect-oxlint';

const combined = Visitor.merge(importVisitor, memberVisitor, statementVisitor);
```

When two visitors handle the same node type, both handlers run sequentially.

### Track depth with `Ref`

Replace mutable `let depth = 0` counters with `Visitor.tracked`:

```ts
import * as Ref from 'effect/Ref';
import { AST, Visitor } from 'effect-oxlint';

const depthRef = yield * Ref.make(0);
const tracker = Visitor.tracked(
	'CallExpression',
	// node is typed as ESTree.CallExpression
	(node) => AST.isCallOf(node, 'Effect', 'gen'),
	depthRef
);
// depthRef increments on enter, decrements on exit
```

### Accumulate and analyze

Collect data during traversal, then analyze at `Program:exit`:

```ts
import { Visitor, AST } from 'effect-oxlint';

const visitor =
	yield *
	Visitor.accumulate(
		'ExportNamedDeclaration',
		(node) => AST.narrow(node, 'ExportNamedDeclaration'),
		function* (exports) {
			// all exports collected — analyze them here
		}
	);
```

### Filter by filename

Restrict a visitor to specific files:

```ts
import { Visitor } from 'effect-oxlint';

const visitor =
	yield *
	Visitor.filter((filename) => !filename.endsWith('.test.ts'), mainVisitor);
```

## AST Matching

Every matcher returns `Option` for safe composition with `pipe`, `Option.map`, and `Option.flatMap`. All public matchers support dual API (data-first and data-last).

```ts
import { pipe } from 'effect';
import * as Option from 'effect/Option';
import type { ESTree } from 'effect-oxlint';
import { AST } from 'effect-oxlint';

// Data-first (pass a MemberExpression directly)
declare const memberNode: ESTree.MemberExpression;
AST.matchMember(memberNode, 'JSON', ['parse', 'stringify']);

// Data-last (pipe-friendly)
pipe(memberNode, AST.matchMember('Effect', 'gen'));

// Chain: narrow an ESTree.Node, then match
declare const node: ESTree.Node;
pipe(
	AST.narrow(node, 'CallExpression'),
	Option.flatMap(AST.matchCallOf('Effect', 'gen'))
);

// Extract member path: a.b.c -> Some(['a', 'b', 'c'])
AST.memberPath(memberNode);

// Match imports by string or predicate
declare const importNode: ESTree.ImportDeclaration;
AST.matchImport(importNode, (src) => src.startsWith('node:'));
```

## Diagnostics and Autofixes

```ts
import { Diagnostic } from 'effect-oxlint';

// Basic diagnostic
const diag = Diagnostic.make({ node, message: 'Avoid this pattern' });

// With autofix
const fixed = Diagnostic.withFix(
	diag,
	Diagnostic.replaceText(node, 'replacement')
);

// Compose multiple fixes
const multiFix = Diagnostic.composeFixes(
	Diagnostic.insertBefore(node, 'prefix'),
	Diagnostic.insertAfter(node, 'suffix')
);
```

## Types

`effect-oxlint` re-exports all `@oxlint/plugins` types so consumers don't need a direct dependency for type imports:

```ts
import type { ESTree, OxlintPlugin, CreateRule } from 'effect-oxlint';

// ESTree namespace includes all AST node types
const node: ESTree.CallExpression = /* ... */;
```

## Testing

`effect-oxlint` ships a `Testing` module with mock AST builders, rule runners, and assertion helpers. It's exposed as a dedicated subpath export so production bundles don't pull in test-only code:

```ts
import { describe, expect, test } from '@effect/vitest';
import * as Option from 'effect/Option';
import { Rule } from 'effect-oxlint';
import * as Testing from 'effect-oxlint/testing';

describe('no-json-parse', () => {
	test('reports JSON.parse', () => {
		const result = Testing.runRule(
			noJsonParse,
			'MemberExpression',
			Testing.memberExpr('JSON', 'parse')
		);
		Testing.expectDiagnostics(result, [{ message: 'Use Schema for JSON' }]);
		// Or use the messages() helper — returns Option per diagnostic
		expect(Testing.messages(result)).toEqual([
			Option.some('Use Schema for JSON')
		]);
	});

	test('ignores other member expressions', () => {
		const result = Testing.runRule(
			noJsonParse,
			'MemberExpression',
			Testing.memberExpr('console', 'log')
		);
		Testing.expectNoDiagnostics(result);
	});
});
```

### Node builders accept ergonomic shorthands

```ts
// newExpr accepts a string — auto-wrapped in id()
Testing.newExpr('Date'); // equivalent to Testing.newExpr(Testing.id('Date'))

// ifStmt params are all optional — useful for enter/exit tracking tests
Testing.ifStmt(); // minimal IfStatement node

// program() accepts a comments parameter for comment-based rules
Testing.program(
	[Testing.exprStmt(Testing.callExpr('foo'))],
	[Testing.comment('Line', ' eslint-disable')]
);
```

Available builders include `id`, `memberExpr`, `computedMemberExpr`, `chainedMemberExpr`, `callExpr`, `callOfMember`, `importDecl`, `newExpr`, `throwStmt`, `tryStmt`, `ifStmt`, `program`, `objectExpr`, and more.

## Modules

| Module        | Purpose                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Rule`        | Core rule builder (`define`, `meta`, `banMember`, `banImport`, `banStatement`, `banCallOf`, `banNewExpr`, `banMultiple`)  |
| `Visitor`     | Composable visitors (`on`, `onExit`, `merge`, `tracked`, `filter`, `accumulate`)                                          |
| `AST`         | `Option`-returning pattern matchers (`matchMember`, `matchCallOf`, `matchImport`, `narrow`, `memberPath`, `findAncestor`) |
| `Diagnostic`  | Diagnostic construction and autofix helpers                                                                               |
| `RuleContext` | Effect service with access to file info, source code, and `report`                                                        |
| `SourceCode`  | Effectful queries: text, tokens, comments, scope, node location                                                           |
| `Scope`       | Variable lookup and reference analysis with `Option`                                                                      |
| `Plugin`      | `define` and `merge` for plugin assembly                                                                                  |
| `Comment`     | Comment type predicates (`isLine`, `isBlock`, `isJSDoc`, `isDisableDirective`)                                            |
| `Token`       | Token type predicates (`isKeyword`, `isPunctuator`, `isIdentifier`, `isString`)                                           |
| `Testing`     | Mock builders, `runRule`, `expectDiagnostics`, `messages` for test harnesses — **import from `effect-oxlint/testing`**  |

## Development

```sh
bun install                # install dependencies
bun run check              # lint + format + typecheck (auto-fix)
bun run test               # run all tests
bun run typecheck          # tsgo type-check only
# Single test file
bunx vitest run test/Rule.test.ts

# By test name
bunx vitest run -t "reports for matching"
```

## Requirements

`effect-oxlint` is distributed as **TypeScript source** (no compiled `dist/`). This keeps source maps, JSDoc, and type information perfectly aligned with the code you import — and it's how JSR prefers packages to ship.

Consumers must use a TypeScript-aware runtime or bundler:

- **Bun** — works out of the box.
- **Deno** (via JSR) — works out of the box.
- **Node.js with a bundler** (Vite, esbuild, webpack, Rollup, tsup, etc.) — works out of the box.
- **Node.js directly** — run via `tsx`, `ts-node`, or compile your own code; ensure `tsconfig.json` has `"moduleResolution": "bundler"` (or `"nodenext"`) so TS resolves the `.ts` `exports` entry.

`effect` is a peer dependency and must be installed alongside `effect-oxlint` at a matching version.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
