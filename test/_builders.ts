/**
 * AST node builders and mock context factories for testing.
 *
 * Builders produce minimal mock objects that satisfy the type shapes
 * our AST/Visitor/Rule modules expect. These are boundary objects —
 * they use `as never` casts at the seam between test mock data and
 * oxlint's strict branded types.
 *
 * @internal
 */
import type {
	Context as OxlintContext,
	CreateRule,
	Diagnostic as OxlintDiagnostic,
	ESTree,
	Visitor as OxlintVisitor
} from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { fromOxlintContext, RuleContext } from '../src/RuleContext.ts';

// ---------------------------------------------------------------------------
// AST node builders
// ---------------------------------------------------------------------------

/** Identifier: `{ type: "Identifier", name }` */
export const id = (name: string) =>
	({ type: 'Identifier', name }) as unknown as ESTree.IdentifierName;

/** MemberExpression: `obj.prop` (non-computed) */
export const memberExpr = (
	obj: string,
	prop: string
): ESTree.MemberExpression =>
	({
		type: 'MemberExpression',
		object: id(obj),
		property: id(prop),
		computed: false,
		optional: false
	}) as never;

/** MemberExpression: `obj[prop]` (computed) */
export const computedMemberExpr = (
	obj: string,
	prop: string
): ESTree.MemberExpression =>
	({
		type: 'MemberExpression',
		object: id(obj),
		property: id(prop),
		computed: true,
		optional: false
	}) as never;

/** CallExpression with bare identifier callee: `name(args)` */
export const callExpr = (
	name: string,
	args: ReadonlyArray<unknown> = []
): ESTree.CallExpression =>
	({
		type: 'CallExpression',
		callee: id(name),
		arguments: args
	}) as never;

/** CallExpression with MemberExpression callee: `obj.prop(args)` */
export const callOfMember = (
	obj: string,
	prop: string,
	args: ReadonlyArray<unknown> = []
): ESTree.CallExpression =>
	({
		type: 'CallExpression',
		callee: memberExpr(obj, prop),
		arguments: args
	}) as never;

/** ImportDeclaration: `import ... from "source"` */
export const importDecl = (source: string): ESTree.ImportDeclaration =>
	({
		type: 'ImportDeclaration',
		source: { type: 'Literal', value: source },
		specifiers: []
	}) as never;

/** String literal: `{ type: "Literal", value }` */
export const strLiteral = (value: string) =>
	({ type: 'Literal', value }) as unknown as ESTree.StringLiteral;

/** ObjectExpression with identifier-keyed properties */
export const objectExpr = (
	properties: ReadonlyArray<{
		readonly key: string;
		readonly value?: unknown;
	}>
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: properties.map((p) => ({
			type: 'Property',
			key: id(p.key),
			value: p.value ?? strLiteral('')
		}))
	}) as never;

/** ObjectExpression with string literal keys */
export const objectExprLiteralKeys = (
	properties: ReadonlyArray<{
		readonly key: string;
		readonly value?: unknown;
	}>
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: properties.map((p) => ({
			type: 'Property',
			key: strLiteral(p.key),
			value: p.value ?? strLiteral('')
		}))
	}) as never;

/** ObjectExpression with a SpreadElement */
export const objectExprWithSpread = (
	spreadArg: unknown
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: [{ type: 'SpreadElement', argument: spreadArg }]
	}) as never;

/** ThrowStatement */
export const throwStmt = (): ESTree.ThrowStatement =>
	({ type: 'ThrowStatement' }) as never;

/** TryStatement */
export const tryStmt = (): ESTree.Node => ({ type: 'TryStatement' }) as never;

/** A generic AST node with type and optional parent pointer */
export const astNode = (
	type: string,
	parent?: { readonly type: string; readonly parent?: unknown }
): { readonly type: string; readonly parent?: unknown } => ({
	type,
	parent
});

/**
 * Build a parent chain from outermost → innermost.
 *
 * Returns the innermost node with `.parent` links to each ancestor.
 *
 * @example
 * ```ts
 * // Creates: FunctionDeclaration → BlockStatement → ThrowStatement
 * // Returns the ThrowStatement node with parent chain
 * withParentChain('FunctionDeclaration', 'BlockStatement', 'ThrowStatement')
 * ```
 */
export const withParentChain = (
	first: string,
	...rest: ReadonlyArray<string>
): { readonly type: string; readonly parent?: unknown } =>
	Arr.reduce(
		rest,
		astNode(first) as {
			readonly type: string;
			readonly parent?: unknown;
		},
		(parent, type) => astNode(type, parent)
	);

// ---------------------------------------------------------------------------
// Mock context + runner
// ---------------------------------------------------------------------------

/** A collected diagnostic from the mock context's `report`. */
export interface ReportedDiagnostic {
	readonly diagnostic: OxlintDiagnostic;
}

/** Options for creating a mock oxlint Context. */
export interface MockContextOptions {
	readonly filename?: string;
	readonly cwd?: string;
	readonly options?: ReadonlyArray<unknown>;
}

/**
 * Create a mock oxlint `Context` and a diagnostics collector.
 *
 * The mock provides the minimal surface required by `RuleContext.fromOxlintContext`.
 */
export const createMockContext = (opts: MockContextOptions = {}) => {
	const diagnostics: Array<ReportedDiagnostic> = [];
	const filename = opts.filename ?? '/test/file.ts';
	const cwd = opts.cwd ?? '/test';
	const sourceCode = {
		text: '',
		ast: { type: 'Program', body: [], comments: [] },
		getText() {
			return '';
		},
		getAllComments() {
			return [];
		},
		getLocFromIndex(index: number) {
			return { line: 1, column: index };
		}
	};
	const context = {
		id: 'effect/test-rule',
		filename,
		physicalFilename: filename,
		cwd,
		options: opts.options ?? [],
		report(diagnostic: OxlintDiagnostic) {
			diagnostics.push({ diagnostic });
		},
		getFilename: () => filename,
		getCwd: () => cwd,
		sourceCode,
		languageOptions: {
			sourceType: 'module',
			ecmaVersion: 2024
		},
		settings: {},
		getSourceCode: () => sourceCode,
		getPhysicalFilename: () => filename,
		parserOptions: {},
		parserPath: undefined
	} as unknown as OxlintContext;

	return { context, diagnostics } as const;
};

/**
 * Create a `Layer` that provides a mock `RuleContext` service.
 *
 * Use this in `it.effect` tests that need to yield visitor handlers
 * (which carry `RuleContext` in their context type).
 */
export const mockRuleContextLayer = (
	opts?: MockContextOptions
): Layer.Layer<RuleContext> => {
	const { context } = createMockContext(opts);
	return Layer.succeed(RuleContext, fromOxlintContext(context));
};

/**
 * Provide a mock `RuleContext` to an effect for testing.
 */
export const withMockRuleContext = <A, E>(
	effect: Effect.Effect<A, E, RuleContext>,
	opts?: MockContextOptions
): Effect.Effect<A, E> => Effect.provide(effect, mockRuleContextLayer(opts));

/** Call a visitor handler on a mock AST node. */
const callHandler = (
	visitors: OxlintVisitor,
	key: string,
	visitorNode: unknown
): void => {
	const handler = visitors[key];
	// Boundary cast: test nodes are plain objects, not real AST nodes
	if (handler) handler(visitorNode as never);
};

/**
 * Run a rule with a single visitor event and collect diagnostics.
 */
export const runRule = (
	rule: CreateRule,
	visitor: string,
	visitorNode: unknown,
	opts?: MockContextOptions
): ReadonlyArray<ReportedDiagnostic> => {
	const { context, diagnostics } = createMockContext(opts);
	const visitors = rule.create(context);
	callHandler(visitors, visitor, visitorNode);
	return diagnostics;
};

/**
 * Run a rule with multiple visitor/node events sequentially
 * (same context, so Ref state persists across calls).
 */
export const runRuleMulti = (
	rule: CreateRule,
	pairs: ReadonlyArray<readonly [visitor: string, node: unknown]>,
	opts?: MockContextOptions
): ReadonlyArray<ReportedDiagnostic> => {
	const { context, diagnostics } = createMockContext(opts);
	const visitors = rule.create(context);
	Arr.forEach(pairs, ([visitor, visitorNode]) => {
		callHandler(visitors, visitor, visitorNode);
	});
	return diagnostics;
};
