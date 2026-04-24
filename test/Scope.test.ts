import { describe, expect, test } from '@effect/vitest';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';

import * as Scope from '../src/Scope.ts';
import * as Testing from '../src/Testing.ts';

// ---------------------------------------------------------------------------
// Shared reference helpers
// ---------------------------------------------------------------------------

const readRef = () => ({
	isRead: () => true,
	isWrite: () => false,
	isReadOnly: () => true,
	isWriteOnly: () => false,
	isReadWrite: () => false
});

const writeRef = () => ({
	isRead: () => false,
	isWrite: () => true,
	isReadOnly: () => false,
	isWriteOnly: () => true,
	isReadWrite: () => false
});

const readWriteRef = () => ({
	isRead: () => true,
	isWrite: () => true,
	isReadOnly: () => false,
	isWriteOnly: () => false,
	isReadWrite: () => true
});

// ---------------------------------------------------------------------------
// findVariable
// ---------------------------------------------------------------------------

describe('Scope.findVariable', () => {
	test('finds a variable by name in the scope', () => {
		const myVar = Testing.variable('myVar');
		const s = Testing.scope({ variables: [myVar] });
		const result = Scope.findVariable(s, 'myVar');
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.map(result, (v) => v.name).pipe(Option.getOrElse(() => ''))
		).toBe('myVar');
	});

	test('returns None when variable is not in scope', () => {
		const s = Testing.scope();
		const result = Scope.findVariable(s, 'notHere');
		expect(Option.isNone(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// findVariableUp
// ---------------------------------------------------------------------------

describe('Scope.findVariableUp', () => {
	test('finds variable in parent scope', () => {
		const parentVar = Testing.variable('parentVar');
		const parentScope = Testing.scope({ variables: [parentVar] });
		const childScope = Testing.scope({ upper: parentScope });
		const result = Scope.findVariableUp(childScope, 'parentVar');
		expect(Option.isSome(result)).toBe(true);
		expect(
			Option.map(result, (v) => v.name).pipe(Option.getOrElse(() => ''))
		).toBe('parentVar');
	});

	test('prefers variable in current scope over parent', () => {
		const parentVar = Testing.variable('x');
		const childVar = Testing.variable('x');
		const parentScope = Testing.scope({ variables: [parentVar] });
		const childScope = Testing.scope({
			variables: [childVar],
			upper: parentScope
		});
		const result = Scope.findVariableUp(childScope, 'x');
		expect(Option.isSome(result)).toBe(true);
		// Should be the child's variable (same name, found first)
		expect(
			Option.match(result, {
				onNone: () => null,
				onSome: (v) => v
			})
		).toBe(childVar);
	});

	test('returns None when variable not found in any scope', () => {
		const parentScope = Testing.scope();
		const childScope = Testing.scope({ upper: parentScope });
		const result = Scope.findVariableUp(childScope, 'notHere');
		expect(Option.isNone(result)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Variable predicates
// ---------------------------------------------------------------------------

describe('Scope.isUsed', () => {
	test('returns true when variable has read references', () => {
		const v = Testing.variable('x', { references: [readRef()] });
		expect(Scope.isUsed(v)).toBe(true);
	});

	test('returns false when variable has no references', () => {
		const v = Testing.variable('x');
		expect(Scope.isUsed(v)).toBe(false);
	});
});

describe('Scope.isWritten', () => {
	test('returns true when variable has write references', () => {
		const v = Testing.variable('x', { references: [writeRef()] });
		expect(Scope.isWritten(v)).toBe(true);
	});

	test('returns false when variable has only read references', () => {
		const v = Testing.variable('x', { references: [readRef()] });
		expect(Scope.isWritten(v)).toBe(false);
	});

	test('returns true for read-write references', () => {
		const v = Testing.variable('x', { references: [readWriteRef()] });
		expect(Scope.isWritten(v)).toBe(true);
	});
});

describe('Scope.isReadOnly', () => {
	test('returns true for read-only references', () => {
		const v = Testing.variable('x', { references: [readRef()] });
		expect(Scope.isReadOnly(v)).toBe(true);
	});

	test('returns false when no read-only references', () => {
		const v = Testing.variable('x', { references: [writeRef()] });
		expect(Scope.isReadOnly(v)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Reference helpers
// ---------------------------------------------------------------------------

describe('Scope.getReferences', () => {
	test('returns all references for a variable', () => {
		const v = Testing.variable('x', {
			references: [readRef(), writeRef()]
		});
		expect(Scope.getReferences(v)).toHaveLength(2);
	});
});

describe('Scope.getReadReferences', () => {
	test('filters to only read references', () => {
		const v = Testing.variable('x', {
			references: [readRef(), writeRef()]
		});
		expect(Scope.getReadReferences(v)).toHaveLength(1);
	});
});

describe('Scope.getWriteReferences', () => {
	test('filters to only write references', () => {
		const v = Testing.variable('x', {
			references: [readRef(), writeRef()]
		});
		expect(Scope.getWriteReferences(v)).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Scope navigation
// ---------------------------------------------------------------------------

describe('Scope.upper', () => {
	test('returns Some when scope has a parent', () => {
		const parent = Testing.scope();
		const child = Testing.scope({ upper: parent });
		const result = Scope.upper(child);
		expect(Option.isSome(result)).toBe(true);
	});

	test('returns None when scope has no parent', () => {
		const s = Testing.scope();
		const result = Scope.upper(s);
		expect(Option.isNone(result)).toBe(true);
	});
});

describe('Scope.childScopes', () => {
	test('returns child scopes', () => {
		const s = Testing.scope();
		expect(Scope.childScopes(s)).toEqual([]);
	});
});

describe('Scope.variables', () => {
	test('returns variables in scope', () => {
		const v = Testing.variable('x');
		const s = Testing.scope({ variables: [v] });
		expect(Scope.variables(s)).toHaveLength(1);
		expect(Scope.variables(s)[0]?.name).toBe('x');
	});
});

describe('Scope.throughReferences', () => {
	test('returns through references from scope', () => {
		const s = Testing.scope();
		expect(Scope.throughReferences(s)).toEqual([]);
	});
});

describe('Scope.isStrict', () => {
	test('returns strict mode flag', () => {
		const strict = Testing.scope({ isStrict: true });
		const nonStrict = Testing.scope({ isStrict: false });
		expect(Scope.isStrict(strict)).toBe(true);
		expect(Scope.isStrict(nonStrict)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Dual API
// ---------------------------------------------------------------------------

describe('Scope dual API', () => {
	test('findVariable supports data-last usage', () => {
		const myVar = Testing.variable('x');
		const s = Testing.scope({ variables: [myVar] });
		const result = pipe(s, Scope.findVariable('x'));
		expect(Option.isSome(result)).toBe(true);
	});

	test('findVariableUp supports data-last usage', () => {
		const parentVar = Testing.variable('y');
		const parentScope = Testing.scope({ variables: [parentVar] });
		const childScope = Testing.scope({ upper: parentScope });
		const result = pipe(childScope, Scope.findVariableUp('y'));
		expect(Option.isSome(result)).toBe(true);
	});
});
