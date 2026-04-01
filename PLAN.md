Now I have a thorough understanding of the complete landscape. Let me present the plan.

---

## Plan: `effect-oxlint` — Effect-First Oxlint Plugin SDK

### Context Summary

**What exists today:**

- `oxlint-effect` (sibling): 49 hand-written lint rules using raw `@oxlint/plugins` API — mutable `let` counters, manual AST pattern matching, ad-hoc utility functions, no auto-fixes, no type-safe options
- `@oxlint/plugins@1.58.0`: ESLint-compatible JS plugin API — `create(context) => Visitor`, ~160 AST node types, SourceCode with ~40 methods, Scope analysis, Fix/Suggestion system, token/comment APIs
- `effect-oxlint` (this repo): Empty scaffold with `effect@4.0.0-beta.43`

**What we're building:**
A library that wraps the entire `@oxlint/plugins` capability surface in Effect-first idioms. Rule authors write fully effectful visitor handlers with `Ref`-based state, `Schema`-decoded options, `Option`-returning AST queries, and `Match`-based branching. Each handler runs through `Effect.runSync` per node visit.

### Architecture

The runtime flow:

1. Oxlint calls `rule.create(context)` — we `Effect.runSync` the rule's create generator, which sets up `Ref` state, decodes options via `Schema`, and returns effectful visitor handlers
2. Each handler is wrapped: `(node) => Effect.runSync(Effect.provide(handler(node), ruleContextLayer))`
3. The `RuleContext` service layer (created once per file) is shared across all handler invocations via closure
4. AST queries (SourceCode, Scope, Tokens) return `Option<T>` for nullable results

### Module Design

```
src/
├── index.ts              # Public barrel export
├── AST.ts                # AST pattern matching with Option/Match
├── Comment.ts            # Comment query helpers
├── Diagnostic.ts         # Structured diagnostic builder
├── Fix.ts                # Composable autofix/suggestion builders
├── Plugin.ts             # Plugin definition and composition
├── Rule.ts               # Rule.define — the core builder
├── RuleContext.ts         # ServiceMap.Service wrapping oxlint Context
├── Scope.ts              # Scope analysis with Option
├── SourceCode.ts         # SourceCode queries with Option
├── Token.ts              # Token navigation with Option
└── Visitor.ts            # Visitor combinators (merge, tracked, etc.)
```

#### Module: `RuleContext` — Effect service wrapping oxlint Context

```ts
// ServiceMap.Service providing the oxlint context
class RuleContext extends ServiceMap.Service<
	RuleContext,
	{
		/** Report a diagnostic. */
		readonly report: (diagnostic: Diagnostic) => Effect.Effect<void>;
		/** Rule ID (e.g. "effect/my-rule"). */
		readonly id: string;
		/** Absolute path of the file being linted. */
		readonly filename: string;
		/** Working directory. */
		readonly cwd: string;
		/** Decoded rule options. */
		readonly options: ReadonlyArray<JsonValue>;
		/** Access to SourceCode queries. */
		readonly sourceCode: SourceCode;
		/** Language options (sourceType, ecmaVersion). */
		readonly languageOptions: LanguageOptions;
		/** Shared settings. */
		readonly settings: Settings;
	}
>()('effect-oxlint/RuleContext') {}
```

#### Module: `Rule` — Core rule builder

```ts
// Rule.define: the main entry point
// Options decoded via Schema at create time
// Create function is an Effect generator — Ref state, service access
// Handlers are Effect generators — yield* Ref.get, yield* RuleContext.report

export const myRule = Rule.define({
	name: 'throw-in-effect-gen',
	meta: Rule.meta({
		type: 'problem',
		description: 'Disallow throw inside Effect.gen'
	}),
	// Schema for options (optional)
	options: Schema.Struct({
		strict: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true))
	}),

	create: function* (options) {
		const ctx = yield* RuleContext;
		const effectGenDepth = yield* Ref.make(0);
		const tryPropertyDepth = yield* Ref.make(0);

		return Visitor.merge(
			Visitor.tracked(
				'CallExpression',
				(node) => AST.isCallOf(node, 'Effect', 'gen'),
				effectGenDepth
			),
			Visitor.tracked(
				'Property',
				(node) => AST.isTryPropertyOfEffectTry(node),
				tryPropertyDepth
			),
			Visitor.on('ThrowStatement', function* (node) {
				const genDepth = yield* Ref.get(effectGenDepth);
				const tryDepth = yield* Ref.get(tryPropertyDepth);
				if (genDepth > 0 && tryDepth === 0) {
					yield* ctx.report({ node, message: '...' });
				}
			})
		);
	}
});
```

Also includes high-level combinators for common patterns:

```ts
// Ban member expression access (replaces memberExprRule utility)
Rule.banMember('JSON', ['parse', 'stringify'], {
	message: 'Use Schema for JSON operations (EF-19)',
	meta: { type: 'suggestion' }
});

// Ban import sources (replaces importRule utility)
Rule.banImport((src) => src.startsWith('node:fs'), {
	message: 'Use Effect FileSystem service (EF-41)'
});

// Ban a statement type
Rule.banStatement('TryStatement', {
	message: 'Use Effect.try/tryPromise (EF-1)'
});
```

#### Module: `Visitor` — Composable visitor construction

```ts
// Visitor.on — single node type handler (Effect generator)
Visitor.on('CallExpression', function*(node) { ... })

// Visitor.merge — combine multiple visitors
Visitor.merge(visitor1, visitor2, visitor3)

// Visitor.tracked — enter/exit depth counter around a Ref<number>
// Auto-increments on enter when predicate matches, decrements on exit
Visitor.tracked('CallExpression',
  (node) => AST.isCallOf(node, 'Effect', 'gen'),
  depthRef
)

// Visitor.onExit — explicit exit handler
Visitor.onExit('CallExpression', function*(node) { ... })

// Visitor.filter — conditionally apply a visitor
Visitor.filter(
  (filename) => !filename.endsWith('.test.ts'),
  mainVisitor
)

// Visitor.accumulate — collect items, then analyze at Program:exit
Visitor.accumulate('ExportNamedDeclaration',
  (node) => extractExportInfo(node),
  function*(accumulated) {
    // Analyze all exports at end of file
  }
)
```

#### Module: `AST` — Pattern matching with Option/Match

All matchers return `Option<NarrowedType>` for safe composition:

```ts
// Match member expression: obj.prop
AST.matchMember(node, 'JSON', 'parse'); // Option<MemberExpression>
AST.matchMember(node, 'JSON', ['parse', 'stringify']); // multi-prop

// Match call expression: obj.prop(args)
AST.matchCallOf(node, 'Effect', 'gen'); // Option<CallExpression>
AST.matchCallOf(node, 'Effect', ['fn', 'fnUntraced']);

// Match import: import ... from "source"
AST.matchImport(node, 'node:fs'); // Option<ImportDeclaration>
AST.matchImport(node, (src) => src.startsWith('node:'));

// Extract callee name from CallExpression
AST.calleeName(node); // Option<string>

// Extract member path: a.b.c → ['a', 'b', 'c']
AST.memberPath(node); // Option<ReadonlyArray<string>>

// Extract import source string
AST.importSource(node); // Option<string>

// Narrow node type safely
AST.narrow(node, 'Identifier'); // Option<Identifier>
AST.narrow(node, 'CallExpression'); // Option<CallExpression>

// Check parent chain
AST.hasAncestor(node, 'FunctionExpression'); // boolean
AST.findAncestor(node, 'ClassDeclaration'); // Option<Class>

// Object property extraction
AST.objectKeys(objExpr); // ReadonlyArray<string>
AST.objectHasKey(objExpr, 'identifier'); // boolean
AST.objectGetValue(objExpr, 'try'); // Option<Expression>
```

#### Module: `SourceCode` — Wrapped queries with Option

```ts
// All nullable returns become Option
SourceCode.getText(node); // string
SourceCode.getAncestors(node); // ReadonlyArray<Node>
SourceCode.getFirstToken(node); // Option<Token>
SourceCode.getLastToken(node); // Option<Token>
SourceCode.getTokenBefore(nodeOrToken); // Option<Token>
SourceCode.getTokenAfter(nodeOrToken); // Option<Token>
SourceCode.getTokensBetween(left, right); // ReadonlyArray<Token>
SourceCode.getNodeByRangeIndex(offset); // Option<Node>
SourceCode.getCommentsBefore(nodeOrToken); // ReadonlyArray<Comment>
SourceCode.getCommentsAfter(nodeOrToken); // ReadonlyArray<Comment>
SourceCode.getJSDocComment(node); // Option<Comment>
```

These read from the `RuleContext` service, so they're `Effect<T, never, RuleContext>` and can be `yield*`'d inside handlers.

#### Module: `Scope` — Scope analysis

```ts
Scope.getScope(node); // Effect<Scope>
Scope.getDeclaredVariables(node); // Effect<ReadonlyArray<Variable>>
Scope.isGlobalReference(node); // Effect<boolean>
Scope.findVariable(scope, name); // Option<Variable>
Scope.getReferences(variable); // ReadonlyArray<Reference>
Scope.isUsed(variable); // boolean
```

#### Module: `Diagnostic` — Structured diagnostic builder

```ts
// Simple diagnostic
Diagnostic.make({ node, message: 'No try/catch (EF-1)' });

// With messageId (from meta.messages)
Diagnostic.fromId({ node, messageId: 'noTryCatch' });

// With data interpolation
Diagnostic.make({
	node,
	message: '`{{name}}` should not be used directly',
	data: { name: 'JSON.parse' }
});

// With fix
Diagnostic.withFix(
	Diagnostic.make({ node, message: '...' }),
	Fix.replaceText(node, 'Schema.decodeUnknown')
);

// With suggestions
Diagnostic.withSuggestions(Diagnostic.make({ node, message: '...' }), [
	Suggestion.make({
		desc: 'Replace with Schema.decodeUnknown',
		fix: Fix.replaceText(node, '...')
	})
]);
```

#### Module: `Fix` — Composable autofix

```ts
// Individual fix operations
Fix.replaceText(nodeOrToken, newText)
Fix.insertBefore(nodeOrToken, text)
Fix.insertAfter(nodeOrToken, text)
Fix.remove(nodeOrToken)
Fix.replaceRange(range, text)

// Compose multiple fixes into one fix function
Fix.compose(
  Fix.remove(importNode),
  Fix.insertBefore(targetNode, 'import * as Arr from "effect/Array";\n')
)

// Suggestion helper
Suggestion.make({ desc: '...', fix: Fix.replaceText(...) })
```

#### Module: `Token` — Token helpers

```ts
Token.isKeyword(token, 'const'); // boolean
Token.isPunctuator(token, '{'); // boolean
Token.isIdentifier(token); // boolean
Token.value(token); // string
```

#### Module: `Comment` — Comment helpers

```ts
Comment.isLine(comment); // boolean
Comment.isBlock(comment); // boolean
Comment.text(comment); // string
Comment.isDisableDirective(comment); // boolean
Comment.isJSDoc(comment); // boolean
```

#### Module: `Plugin` — Plugin definition

```ts
// Define a typed plugin
const myPlugin = Plugin.define({
	name: 'my-effect-rules',
	rules: {
		'no-throw-in-gen': throwInEffectGenRule,
		'prefer-effect-fn': preferEffectFnRule
	}
});

// Merge plugins
Plugin.merge(pluginA, pluginB);
```

#### Module: `Testing` — Test infrastructure

```ts
// Create a mock RuleContext layer for testing
Testing.mockContext({ filename: '/test/file.ts' });

// Run a rule against visitor events and collect diagnostics
Testing.run(myRule, [
	['CallExpression', AST.Builders.callOfMember('Effect', 'gen')],
	['ThrowStatement', AST.Builders.throwStmt()],
	['CallExpression:exit', AST.Builders.callOfMember('Effect', 'gen')]
]);
// Returns: ReadonlyArray<Diagnostic>

// AST node builders (re-exported from a Builders namespace)
Testing.Builders.id('foo');
Testing.Builders.memberExpr('Effect', 'gen');
Testing.Builders.callOfMember('Effect', 'gen', [arrowFn]);
Testing.Builders.importDecl('node:fs');
Testing.Builders.objectExpr([{ key: 'title', value: strLiteral('x') }]);
// ... all existing builders from sibling repo, plus new ones

// Assertion helpers for @effect/vitest
Testing.expectDiagnostics(result, [{ message: Match.string.includes('EF-1') }]);
Testing.expectNoDiagnostics(result);
```

### Re-exports

The library re-exports all types from `@oxlint/plugins` under a clean namespace so consumers don't need to depend on `@oxlint/plugins` directly:

```ts
// Re-exported from effect-oxlint
import type { ESTree, Context, Visitor, Token, Comment } from 'effect-oxlint';
```

### Implementation Phases

**Phase 1: Core Infrastructure**

- `RuleContext` service
- `Rule.define` (full Effect runtime with Ref, Schema options, service access)
- `Visitor.on`, `Visitor.onExit`, `Visitor.merge`
- `AST.matchMember`, `AST.matchCallOf`, `AST.matchImport`
- Type re-exports from `@oxlint/plugins`

**Phase 2: Convenience Combinators**

- `Rule.banMember`, `Rule.banImport`, `Rule.banStatement`
- `Visitor.tracked` (auto Ref increment/decrement)
- `Visitor.accumulate`
- `Visitor.filter`
- Remaining `AST` helpers (narrow, ancestors, object extraction)

**Phase 3: Full API Surface**

- `SourceCode` module (wrapped queries)
- `Scope` module
- `Token` / `Comment` modules
- `Diagnostic` module (structured builder)
- `Fix` module (composable fixes)
- `Plugin.define` / `Plugin.merge`

**Phase 4: Testing Infrastructure**

- `Testing.mockContext`
- `Testing.run`
- `Testing.Builders` (AST node builders)
- `Testing.expectDiagnostics`
- Integration with `@effect/vitest`

### How It Transforms the Sibling Rules

To illustrate the value, here's how the most complex rule (`prefer-effect-fn` — 3 mutable counters, nested AST analysis) would look:

**Before (124 lines, mutable state, manual AST checks):**

```ts
let serviceDefDepth = 0;
let effectFnDepth = 0;
let serviceMakeDepth = 0;
// ... 100+ lines of manual node.type checks and depth tracking
```

**After (~40 lines, Ref state, composable visitors):**

```ts
export default Rule.define({
	name: 'prefer-effect-fn',
	meta: Rule.meta({ type: 'suggestion', description: '...' }),
	create: function* () {
		const ctx = yield* RuleContext;
		const serviceDefDepth = yield* Ref.make(0);
		const effectFnDepth = yield* Ref.make(0);
		const serviceMakeDepth = yield* Ref.make(0);

		return Visitor.merge(
			Visitor.tracked(
				'CallExpression',
				(n) => AST.isServiceMapServiceCall(n),
				serviceDefDepth
			),
			Visitor.tracked(
				'CallExpression',
				(n) => AST.isCallOf(n, 'Effect', ['fn', 'fnUntraced']),
				effectFnDepth
			),
			Visitor.on('CallExpression', function* (node) {
				const fnDepth = yield* Ref.get(effectFnDepth);
				if (fnDepth > 0) return;
				yield* pipe(
					AST.matchCallOf(node, 'Effect', 'gen'),
					Option.flatMap(() =>
						checkContext(node, serviceDefDepth, serviceMakeDepth)
					),
					Option.map((msg) => ctx.report({ node, message: msg })),
					Effect.void
				);
			})
		);
	}
});
```
