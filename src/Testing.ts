/**
 * Public testing infrastructure for Effect-first oxlint rules.
 *
 * Provides AST node builders, mock context factories, rule runners,
 * and assertion helpers for use with `@effect/vitest`.
 *
 * @example
 * ```ts
 * import { Testing, Rule } from 'effect-oxlint'
 *
 * const result = Testing.runRule(myRule, 'ThrowStatement', Testing.throwStmt())
 * Testing.expectDiagnostics(result, [{ message: 'No throw in Effect.gen' }])
 * ```
 *
 * @since 0.2.0
 */
import type {
	Comment,
	Context as OxlintContext,
	CreateRule,
	Diagnostic as OxlintDiagnostic,
	ESTree,
	Scope as OxlintScope,
	Token,
	Variable,
	Visitor as OxlintVisitor
} from '@oxlint/plugins';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';

import { fromOxlintContext, RuleContext } from './RuleContext.ts';

// ---------------------------------------------------------------------------
// AST Node Builders
// ---------------------------------------------------------------------------

/**
 * Minimal AST node builders for tests.
 *
 * These produce mock objects satisfying the type shapes that AST/Visitor/Rule
 * modules expect. They use boundary casts at the seam between test mock
 * data and oxlint's strict branded types.
 *
 * @since 0.2.0
 */

/**
 * Identifier: `{ type: "Identifier", name }`
 *
 * @since 0.2.0
 */
export const id = (name: string): ESTree.IdentifierName =>
	({ type: 'Identifier', name }) as never;

/**
 * MemberExpression: `obj.prop` (non-computed)
 *
 * @since 0.2.0
 */
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

/**
 * MemberExpression: `obj[prop]` (computed)
 *
 * @since 0.2.0
 */
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

/**
 * Chained MemberExpression: `a.b.c` (non-computed)
 *
 * @since 0.2.0
 */
export const chainedMemberExpr = (
	...names: readonly [string, string, ...ReadonlyArray<string>]
): ESTree.MemberExpression => {
	const [first, second, ...rest] = names;
	const initial = memberExpr(first, second);
	return Arr.reduce(
		rest,
		initial,
		(acc, name) =>
			({
				type: 'MemberExpression',
				object: acc,
				property: id(name),
				computed: false,
				optional: false
			}) as never
	);
};

/**
 * CallExpression with bare identifier callee: `name(args)`
 *
 * @since 0.2.0
 */
export const callExpr = (
	name: string,
	args: ReadonlyArray<unknown> = []
): ESTree.CallExpression =>
	({
		type: 'CallExpression',
		callee: id(name),
		arguments: args
	}) as never;

/**
 * CallExpression with MemberExpression callee: `obj.prop(args)`
 *
 * @since 0.2.0
 */
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

/**
 * ImportDeclaration: `import ... from "source"`
 *
 * @since 0.2.0
 */
export const importDecl = (source: string): ESTree.ImportDeclaration =>
	({
		type: 'ImportDeclaration',
		source: { type: 'Literal', value: source },
		specifiers: []
	}) as never;

/**
 * String literal: `{ type: "Literal", value }`
 *
 * @since 0.2.0
 */
export const strLiteral = (value: string): ESTree.StringLiteral =>
	({ type: 'Literal', value }) as never;

/**
 * Numeric literal: `{ type: "Literal", value }`
 *
 * @since 0.2.0
 */
export const numLiteral = (value: number): ESTree.NumericLiteral =>
	({ type: 'Literal', value }) as never;

/**
 * Boolean literal: `{ type: "Literal", value }`
 *
 * @since 0.2.0
 */
export const boolLiteral = (value: boolean): ESTree.BooleanLiteral =>
	({ type: 'Literal', value }) as never;

/**
 * ObjectExpression with identifier-keyed properties.
 *
 * @since 0.2.0
 */
export const objectExpr = (
	properties: ReadonlyArray<{
		readonly key: string;
		readonly value?: unknown;
	}>
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: Arr.map(properties, (p) => ({
			type: 'Property',
			key: id(p.key),
			value: p.value ?? strLiteral('')
		}))
	}) as never;

/**
 * ObjectExpression with string literal keys.
 *
 * @since 0.2.0
 */
export const objectExprLiteralKeys = (
	properties: ReadonlyArray<{
		readonly key: string;
		readonly value?: unknown;
	}>
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: Arr.map(properties, (p) => ({
			type: 'Property',
			key: strLiteral(p.key),
			value: p.value ?? strLiteral('')
		}))
	}) as never;

/**
 * ObjectExpression with a SpreadElement.
 *
 * @since 0.2.0
 */
export const objectExprWithSpread = (
	spreadArg: unknown
): ESTree.ObjectExpression =>
	({
		type: 'ObjectExpression',
		properties: [{ type: 'SpreadElement', argument: spreadArg }]
	}) as never;

/**
 * ThrowStatement.
 *
 * @since 0.2.0
 */
export const throwStmt = (): ESTree.ThrowStatement =>
	({ type: 'ThrowStatement' }) as never;

/**
 * TryStatement.
 *
 * @since 0.2.0
 */
export const tryStmt = (): ESTree.Node => ({ type: 'TryStatement' }) as never;

/**
 * ReturnStatement.
 *
 * @since 0.2.0
 */
export const returnStmt = (argument?: unknown): ESTree.ReturnStatement =>
	({ type: 'ReturnStatement', argument: argument ?? null }) as never;

/**
 * BlockStatement.
 *
 * @since 0.2.0
 */
export const blockStmt = (
	body: ReadonlyArray<unknown> = []
): ESTree.BlockStatement =>
	({ type: 'BlockStatement', body: Array.from(body) }) as never;

/**
 * ArrowFunctionExpression.
 *
 * @since 0.2.0
 */
export const arrowFn = (
	body?: unknown,
	params: ReadonlyArray<unknown> = []
): ESTree.ArrowFunctionExpression =>
	({
		type: 'ArrowFunctionExpression',
		params: Array.from(params),
		body: body ?? blockStmt(),
		expression: false,
		async: false
	}) as never;

/**
 * VariableDeclaration: `const/let/var name = init`
 *
 * @since 0.2.0
 */
export const varDecl = (
	kind: 'const' | 'let' | 'var',
	name: string,
	init?: unknown
): ESTree.VariableDeclaration =>
	({
		type: 'VariableDeclaration',
		kind,
		declarations: [
			{
				type: 'VariableDeclarator',
				id: id(name),
				init: init ?? null
			}
		]
	}) as never;

/**
 * ExpressionStatement.
 *
 * @since 0.2.0
 */
export const exprStmt = (expression: unknown): ESTree.ExpressionStatement =>
	({ type: 'ExpressionStatement', expression }) as never;

/**
 * Program node.
 *
 * @since 0.2.0
 */
export const program = (
	body: ReadonlyArray<unknown> = [],
	comments: ReadonlyArray<unknown> = []
): ESTree.Program =>
	({
		type: 'Program',
		body: Array.from(body),
		comments: Array.from(comments),
		sourceType: 'module'
	}) as never;

/**
 * IfStatement.
 *
 * All parameters are optional — `ifStmt()` produces a minimal
 * `{ type: 'IfStatement' }` node suitable for enter/exit tracking.
 *
 * @since 0.2.0
 */
export const ifStmt = (
	test?: unknown,
	consequent?: unknown,
	alternate?: unknown
): ESTree.IfStatement =>
	({
		type: 'IfStatement',
		test: test ?? null,
		consequent: consequent ?? null,
		alternate: alternate ?? null
	}) as never;

/**
 * BinaryExpression.
 *
 * @since 0.2.0
 */
export const binaryExpr = (
	operator: string,
	left: unknown,
	right: unknown
): ESTree.BinaryExpression =>
	({ type: 'BinaryExpression', operator, left, right }) as never;

/**
 * NewExpression: `new callee(args)`
 *
 * When `callee` is a string it is auto-wrapped in `id()`, so
 * `newExpr('Date')` is equivalent to `newExpr(id('Date'))`.
 *
 * @since 0.2.0
 */
export const newExpr: {
	(callee: string, args?: ReadonlyArray<unknown>): ESTree.NewExpression;
	(callee: unknown, args?: ReadonlyArray<unknown>): ESTree.NewExpression;
} = (
	callee: unknown,
	args: ReadonlyArray<unknown> = []
): ESTree.NewExpression =>
	({
		type: 'NewExpression',
		callee: P.isString(callee) ? id(callee) : callee,
		arguments: Array.from(args)
	}) as never;

/**
 * A generic AST node with type and optional parent pointer.
 *
 * @since 0.2.0
 */
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
 * withParentChain('FunctionDeclaration', 'BlockStatement', 'ThrowStatement')
 * ```
 *
 * @since 0.2.0
 */
export const withParentChain = (
	first: string,
	...rest: ReadonlyArray<string>
): { readonly type: string; readonly parent?: unknown } =>
	Arr.reduce(
		rest,
		astNode(first) satisfies {
			readonly type: string;
			readonly parent?: unknown;
		},
		(parent, type) => astNode(type, parent)
	);

/**
 * Mock Token.
 *
 * @since 0.2.0
 */
export const token = (type: Token['type'], value: string): Token =>
	({
		type,
		value,
		start: 0,
		end: value.length,
		range: [0, value.length],
		loc: {
			start: { line: 1, column: 0 },
			end: { line: 1, column: value.length }
		},
		regex: undefined
	}) as never;

/**
 * Mock Comment.
 *
 * @since 0.2.0
 */
export const comment = (type: Comment['type'], value: string): Comment =>
	({
		type,
		value,
		start: 0,
		end: value.length + 4,
		range: [0, value.length + 4],
		loc: {
			start: { line: 1, column: 0 },
			end: { line: 1, column: value.length + 4 }
		}
	}) as never;

/**
 * Mock Scope with minimal surface.
 *
 * @since 0.2.0
 */
export const scope = (
	opts: {
		readonly type?: OxlintScope['type'];
		readonly isStrict?: boolean;
		readonly variables?: ReadonlyArray<Variable>;
		readonly upper?: OxlintScope | null;
	} = {}
): OxlintScope => {
	const vars = Array.from(opts.variables ?? []);
	const set = new Map<string, Variable>(vars.map((v) => [v.name, v]));
	return {
		type: opts.type ?? 'function',
		isStrict: opts.isStrict ?? false,
		upper: opts.upper ?? null,
		childScopes: [],
		variableScope: null as never,
		block: {} as never,
		variables: vars,
		set,
		references: [],
		through: [],
		functionExpressionScope: false
	};
};

/**
 * Mock Variable.
 *
 * @since 0.2.0
 */
export const variable = (
	name: string,
	opts: {
		readonly references?: ReadonlyArray<{
			readonly isRead: () => boolean;
			readonly isWrite: () => boolean;
			readonly isReadOnly: () => boolean;
			readonly isWriteOnly: () => boolean;
			readonly isReadWrite: () => boolean;
		}>;
	} = {}
): Variable =>
	({
		name,
		scope: {} as never,
		identifiers: [id(name)],
		references: Array.from(opts.references ?? []),
		defs: []
	}) as never;

// ---------------------------------------------------------------------------
// Statement Builders
// ---------------------------------------------------------------------------

/**
 * SwitchStatement.
 *
 * @since 0.2.0
 */
export const switchStmt = (): ESTree.SwitchStatement =>
	({ type: 'SwitchStatement', discriminant: null, cases: [] }) as never;

/**
 * ForStatement.
 *
 * @since 0.2.0
 */
export const forStmt = (): ESTree.ForStatement =>
	({
		type: 'ForStatement',
		init: null,
		test: null,
		update: null,
		body: blockStmt()
	}) as never;

/**
 * ForInStatement.
 *
 * @since 0.2.0
 */
export const forInStmt = (): ESTree.ForInStatement =>
	({
		type: 'ForInStatement',
		left: id('_'),
		right: id('_'),
		body: blockStmt()
	}) as never;

/**
 * ForOfStatement.
 *
 * @since 0.2.0
 */
export const forOfStmt = (): ESTree.ForOfStatement =>
	({
		type: 'ForOfStatement',
		await: false,
		left: id('_'),
		right: id('_'),
		body: blockStmt()
	}) as never;

/**
 * WhileStatement.
 *
 * @since 0.2.0
 */
export const whileStmt = (): ESTree.WhileStatement =>
	({
		type: 'WhileStatement',
		test: boolLiteral(true),
		body: blockStmt()
	}) as never;

/**
 * DoWhileStatement.
 *
 * @since 0.2.0
 */
export const doWhileStmt = (): ESTree.DoWhileStatement =>
	({
		type: 'DoWhileStatement',
		test: boolLiteral(true),
		body: blockStmt()
	}) as never;

// ---------------------------------------------------------------------------
// Expression Builders
// ---------------------------------------------------------------------------

/**
 * YieldExpression.
 *
 * @since 0.2.0
 */
export const yieldExpr = (
	argument?: unknown,
	delegate: boolean = false
): ESTree.YieldExpression =>
	({
		type: 'YieldExpression',
		argument: argument ?? null,
		delegate
	}) as never;

/**
 * UnaryExpression: `operator argument`
 *
 * @since 0.2.0
 */
export const unaryExpr = (
	operator: string,
	argument: unknown
): ESTree.UnaryExpression =>
	({ type: 'UnaryExpression', operator, prefix: true, argument }) as never;

// ---------------------------------------------------------------------------
// Declaration Builders
// ---------------------------------------------------------------------------

/**
 * VariableDeclarator (standalone, without wrapping VariableDeclaration).
 *
 * @since 0.2.0
 */
export const varDeclarator = (
	name: string,
	init?: unknown
): ESTree.VariableDeclarator =>
	({
		type: 'VariableDeclarator',
		id: id(name),
		init: init ?? null
	}) as never;

/**
 * ExportNamedDeclaration.
 *
 * @since 0.2.0
 */
export const exportNamedDecl = (
	declaration?: unknown
): ESTree.ExportNamedDeclaration =>
	({
		type: 'ExportNamedDeclaration',
		declaration: declaration ?? null,
		specifiers: [],
		source: null
	}) as never;

// ---------------------------------------------------------------------------
// Import Specifier Builders
// ---------------------------------------------------------------------------

/**
 * ImportDeclaration with specifiers: `import { a, b } from "source"`
 *
 * @since 0.2.0
 */
export const importDeclWithSpecifiers = (
	source: string,
	specifiers: ReadonlyArray<unknown>,
	importKind: string = 'value'
): ESTree.ImportDeclaration =>
	({
		type: 'ImportDeclaration',
		source: { type: 'Literal', value: source },
		specifiers: Array.from(specifiers),
		importKind
	}) as never;

/**
 * ImportSpecifier: `{ imported as local }`
 *
 * @since 0.2.0
 */
export const importSpecifier = (
	imported: string,
	local?: string,
	importKind: string = 'value'
): ESTree.ImportSpecifier =>
	({
		type: 'ImportSpecifier',
		imported: id(imported),
		local: id(local ?? imported),
		importKind
	}) as never;

/**
 * ImportNamespaceSpecifier: `* as local`
 *
 * @since 0.2.0
 */
export const importNamespaceSpecifier = (
	local: string
): ESTree.ImportNamespaceSpecifier =>
	({
		type: 'ImportNamespaceSpecifier',
		local: id(local)
	}) as never;

// ---------------------------------------------------------------------------
// TypeScript Node Builders
// ---------------------------------------------------------------------------

/**
 * TSAsExpression: `expr as Type`
 *
 * @since 0.2.0
 */
export const tsAsExpr = (
	typeKind: string,
	parent?: { readonly type: string; readonly parent?: unknown }
): ESTree.TSAsExpression =>
	({
		type: 'TSAsExpression',
		expression: id('_'),
		typeAnnotation: { type: typeKind },
		parent
	}) as never;

/**
 * TSUnionType: `A | B | C`
 *
 * @since 0.2.0
 */
export const tsUnionType = (
	typeKinds: ReadonlyArray<string>
): ESTree.TSUnionType =>
	({
		type: 'TSUnionType',
		types: Arr.map(typeKinds, (t) => ({ type: t }))
	}) as never;

/**
 * TSTypeReference: `TypeName`
 *
 * @since 0.2.0
 */
export const tsTypeRef = (name: string): ESTree.TSTypeReference =>
	({
		type: 'TSTypeReference',
		typeName: id(name),
		typeArguments: null
	}) as never;

/**
 * TSTypeLiteral: `{ ... }` with N members.
 *
 * @since 0.2.0
 */
export const tsTypeLiteral = (memberCount: number): ESTree.TSTypeLiteral =>
	({
		type: 'TSTypeLiteral',
		members: Array.from({ length: memberCount }, () => ({
			type: 'TSPropertySignature'
		}))
	}) as never;

/**
 * TSInterfaceDeclaration: `interface Name { }`
 *
 * @since 0.2.0
 */
export const interfaceDecl = (name: string): ESTree.TSInterfaceDeclaration =>
	({
		type: 'TSInterfaceDeclaration',
		id: { type: 'BindingIdentifier', name },
		body: { type: 'TSInterfaceBody', body: [] }
	}) as never;

/**
 * TSTypeAliasDeclaration: `type Name = ...`
 *
 * @since 0.2.0
 */
export const typeAliasDecl = (name: string): ESTree.TSTypeAliasDeclaration =>
	({
		type: 'TSTypeAliasDeclaration',
		id: { type: 'BindingIdentifier', name },
		typeAnnotation: null
	}) as never;

// ---------------------------------------------------------------------------
// Class Node Builders
// ---------------------------------------------------------------------------

/**
 * ClassDeclaration with optional superClass and body members.
 *
 * @example
 * ```ts
 * // Simple: class Foo {}
 * classDecl('Foo')
 *
 * // With super: class Foo extends Bar {}
 * classDecl('Foo', { superClass: Testing.id('Bar') })
 *
 * // With members: class Foo { x; static y() {} }
 * classDecl('Foo', {
 *     members: [Testing.propertyDef('x'), Testing.methodDef('y', true)]
 * })
 * ```
 *
 * @since 0.2.0
 */
export const classDecl = (
	name: string,
	opts: {
		readonly superClass?: unknown;
		readonly members?: ReadonlyArray<unknown>;
	} = {}
): ESTree.Class =>
	({
		type: 'ClassDeclaration',
		id: { type: 'BindingIdentifier', name },
		superClass: opts.superClass ?? null,
		body: {
			type: 'ClassBody',
			body: Array.from(opts.members ?? [])
		},
		decorators: []
	}) as never;

/**
 * PropertyDefinition: class field.
 *
 * @since 0.2.0
 */
export const propertyDef = (
	name: string,
	isStatic: boolean = false
): ESTree.PropertyDefinition =>
	({
		type: 'PropertyDefinition',
		key: id(name),
		value: null,
		computed: false,
		static: isStatic,
		decorators: []
	}) as never;

/**
 * MethodDefinition: class method.
 *
 * @since 0.2.0
 */
export const methodDef = (
	name: string,
	isStatic: boolean = false
): ESTree.MethodDefinition =>
	({
		type: 'MethodDefinition',
		key: id(name),
		kind: 'method',
		value: arrowFn(),
		computed: false,
		static: isStatic,
		decorators: []
	}) as never;

// ---------------------------------------------------------------------------
// Mock Context
// ---------------------------------------------------------------------------

/**
 * A collected diagnostic from the mock context's `report`.
 *
 * @since 0.2.0
 */
export interface ReportedDiagnostic {
	readonly diagnostic: OxlintDiagnostic;
}

/**
 * Options for creating a mock oxlint Context.
 *
 * @since 0.2.0
 */
export interface MockContextOptions {
	readonly filename?: string;
	readonly cwd?: string;
	readonly options?: ReadonlyArray<unknown>;
	readonly sourceText?: string;
	readonly comments?: ReadonlyArray<Comment>;
}

/**
 * Create a mock oxlint `Context` and a diagnostics collector.
 *
 * The mock provides the minimal surface required by `RuleContext.fromOxlintContext`.
 *
 * @since 0.2.0
 */
export const createMockContext = (opts: MockContextOptions = {}) => {
	const diagnostics: Array<ReportedDiagnostic> = [];
	const filename = opts.filename ?? '/test/file.ts';
	const cwd = opts.cwd ?? '/test';
	const text = opts.sourceText ?? '';
	const comments = Array.from(opts.comments ?? []);
	const sourceCode = {
		text,
		ast: { type: 'Program', body: [], comments },
		getText() {
			return text;
		},
		getAllComments() {
			return comments;
		},
		getLocFromIndex(index: number) {
			return { line: 1, column: index };
		},
		getIndexFromLoc(loc: { line: number; column: number }) {
			return loc.column;
		},
		getAncestors() {
			return [];
		},
		getScope() {
			return scope();
		},
		getDeclaredVariables() {
			return [];
		},
		isGlobalReference() {
			return false;
		},
		markVariableAsUsed() {
			return false;
		},
		getFirstToken() {
			return null;
		},
		getLastToken() {
			return null;
		},
		getTokens() {
			return [];
		},
		getTokenBefore() {
			return null;
		},
		getTokenAfter() {
			return null;
		},
		getTokensBetween() {
			return [];
		},
		getFirstTokenBetween() {
			return null;
		},
		getTokenByRangeStart() {
			return null;
		},
		getCommentsBefore() {
			return [];
		},
		getCommentsAfter() {
			return [];
		},
		getCommentsInside() {
			return [];
		},
		commentsExistBetween() {
			return false;
		},
		getJSDocComment() {
			return null;
		},
		getNodeByRangeIndex() {
			return null;
		},
		getRange() {
			return [0, 0];
		},
		getLoc() {
			return {
				start: { line: 1, column: 0 },
				end: { line: 1, column: 0 }
			};
		},
		getLines() {
			return text.split('\n');
		},
		isSpaceBetween() {
			return false;
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

// ---------------------------------------------------------------------------
// Mock RuleContext Layer
// ---------------------------------------------------------------------------

/**
 * Create a `Layer` that provides a mock `RuleContext` service.
 *
 * Use in `it.effect` tests that need to `yield*` visitor handlers
 * (which carry `RuleContext` in their context type).
 *
 * @since 0.2.0
 */
export const mockRuleContextLayer = (
	opts?: MockContextOptions
): Layer.Layer<RuleContext> => {
	const { context } = createMockContext(opts);
	return Layer.succeed(RuleContext, fromOxlintContext(context));
};

/**
 * Provide a mock `RuleContext` to an effect for testing.
 *
 * @since 0.2.0
 */
export const withMockRuleContext = <A, E>(
	effect: Effect.Effect<A, E, RuleContext>,
	opts?: MockContextOptions
): Effect.Effect<A, E> => Effect.provide(effect, mockRuleContextLayer(opts));

// ---------------------------------------------------------------------------
// Rule Runner
// ---------------------------------------------------------------------------

/** @internal Call a visitor handler on a mock AST node. */
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
 *
 * @since 0.2.0
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
 * Run a rule with multiple visitor/node events sequentially.
 *
 * Same context is shared so `Ref` state persists across calls.
 *
 * @since 0.2.0
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

// ---------------------------------------------------------------------------
// Diagnostic Accessors
// ---------------------------------------------------------------------------

/**
 * Extract the diagnostic messages from a result array.
 *
 * Returns `Option.none()` when a diagnostic uses `messageId` instead
 * of `message`, or when the message is `null`.
 *
 * @example
 * ```ts
 * import * as Option from 'effect/Option'
 *
 * const result = Testing.runRule(rule, 'ThrowStatement', Testing.throwStmt())
 * expect(Testing.messages(result)).toEqual([Option.some('Use Effect.fail instead')])
 * ```
 *
 * @since 0.2.0
 */
export const messages = (
	result: ReadonlyArray<ReportedDiagnostic>
): ReadonlyArray<Option.Option<string>> =>
	Arr.map(result, (r) => Option.fromNullishOr(r.diagnostic.message));

/**
 * Extract the diagnostic messageIds from a result array.
 *
 * Returns `Option.none()` when a diagnostic uses `message` instead
 * of `messageId`, or when the messageId is `null`.
 *
 * @since 0.2.0
 */
export const messageIds = (
	result: ReadonlyArray<ReportedDiagnostic>
): ReadonlyArray<Option.Option<string>> =>
	Arr.map(result, (r) => Option.fromNullishOr(r.diagnostic.messageId));

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that diagnostics match expected patterns.
 *
 * Each matcher is partially checked — only provided fields are compared.
 * This allows flexible matching without specifying every field.
 *
 * @example
 * ```ts
 * Testing.expectDiagnostics(result, [
 *   { message: 'No throw in Effect.gen' },
 *   { messageId: 'noTryCatch' }
 * ])
 * ```
 *
 * @since 0.2.0
 */
export const expectDiagnostics = (
	result: ReadonlyArray<ReportedDiagnostic>,
	expected: ReadonlyArray<{
		readonly message?: string;
		readonly messageId?: string;
	}>
): void => {
	if (result.length !== expected.length) {
		throw new Error(
			`Expected ${expected.length} diagnostics, got ${result.length}:\n` +
				Arr.join(
					Arr.map(
						result,
						(r) =>
							`  - ${r.diagnostic.message ?? r.diagnostic.messageId ?? '(unknown)'}`
					),
					'\n'
				)
		);
	}
	Arr.forEach(expected, (exp, i) => {
		const actual = result[i];
		if (actual === undefined) {
			throw new Error(`Missing diagnostic at index ${i}`);
		}
		if (
			exp.message !== undefined &&
			actual.diagnostic.message !== exp.message
		) {
			throw new Error(
				`Diagnostic ${i}: expected message "${exp.message}", got "${actual.diagnostic.message}"`
			);
		}
		if (
			exp.messageId !== undefined &&
			actual.diagnostic.messageId !== exp.messageId
		) {
			throw new Error(
				`Diagnostic ${i}: expected messageId "${exp.messageId}", got "${actual.diagnostic.messageId}"`
			);
		}
	});
};

/**
 * Assert that no diagnostics were reported.
 *
 * @since 0.2.0
 */
export const expectNoDiagnostics = (
	result: ReadonlyArray<ReportedDiagnostic>
): void =>
	Arr.match(result, {
		onEmpty: () => {},
		onNonEmpty: (items) => {
			throw new Error(
				`Expected no diagnostics, got ${items.length}:\n` +
					Arr.join(
						Arr.map(
							items,
							(r) =>
								`  - ${r.diagnostic.message ?? r.diagnostic.messageId ?? '(unknown)'}`
						),
						'\n'
					)
			);
		}
	});
