import { describe, expect, test } from '@effect/vitest';
import * as Option from 'effect/Option';

import * as Scope from '../src/Scope.ts';
import { Testing } from '../src/index.ts';

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
		const v = Testing.variable('x', {
			references: [
				{
					isRead: () => true,
					isWrite: () => false,
					isReadOnly: () => true,
					isWriteOnly: () => false,
					isReadWrite: () => false
				}
			]
		});
		expect(Scope.isUsed(v)).toBe(true);
	});

	test('returns false when variable has no references', () => {
		const v = Testing.variable('x');
		expect(Scope.isUsed(v)).toBe(false);
	});
});

describe('Scope.isWritten', () => {
	test('returns true when variable has write references', () => {
		const v = Testing.variable('x', {
			references: [
				{
					isRead: () => false,
					isWrite: () => true,
					isReadOnly: () => false,
					isWriteOnly: () => true,
					isReadWrite: () => false
				}
			]
		});
		expect(Scope.isWritten(v)).toBe(true);
	});

	test('returns false when variable has only read references', () => {
		const v = Testing.variable('x', {
			references: [
				{
					isRead: () => true,
					isWrite: () => false,
					isReadOnly: () => true,
					isWriteOnly: () => false,
					isReadWrite: () => false
				}
			]
		});
		expect(Scope.isWritten(v)).toBe(false);
	});
});

describe('Scope.isReadOnly', () => {
	test('returns true for read-only references', () => {
		const v = Testing.variable('x', {
			references: [
				{
					isRead: () => true,
					isWrite: () => false,
					isReadOnly: () => true,
					isWriteOnly: () => false,
					isReadWrite: () => false
				}
			]
		});
		expect(Scope.isReadOnly(v)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Reference helpers
// ---------------------------------------------------------------------------

describe('Scope.getReferences', () => {
	test('returns all references for a variable', () => {
		const ref1 = {
			isRead: () => true,
			isWrite: () => false,
			isReadOnly: () => true,
			isWriteOnly: () => false,
			isReadWrite: () => false
		};
		const ref2 = {
			isRead: () => false,
			isWrite: () => true,
			isReadOnly: () => false,
			isWriteOnly: () => true,
			isReadWrite: () => false
		};
		const v = Testing.variable('x', { references: [ref1, ref2] });
		expect(Scope.getReferences(v)).toHaveLength(2);
	});
});

describe('Scope.getReadReferences', () => {
	test('filters to only read references', () => {
		const readRef = {
			isRead: () => true,
			isWrite: () => false,
			isReadOnly: () => true,
			isWriteOnly: () => false,
			isReadWrite: () => false
		};
		const writeRef = {
			isRead: () => false,
			isWrite: () => true,
			isReadOnly: () => false,
			isWriteOnly: () => true,
			isReadWrite: () => false
		};
		const v = Testing.variable('x', {
			references: [readRef, writeRef]
		});
		expect(Scope.getReadReferences(v)).toHaveLength(1);
	});
});

describe('Scope.getWriteReferences', () => {
	test('filters to only write references', () => {
		const readRef = {
			isRead: () => true,
			isWrite: () => false,
			isReadOnly: () => true,
			isWriteOnly: () => false,
			isReadWrite: () => false
		};
		const writeRef = {
			isRead: () => false,
			isWrite: () => true,
			isReadOnly: () => false,
			isWriteOnly: () => true,
			isReadWrite: () => false
		};
		const v = Testing.variable('x', {
			references: [readRef, writeRef]
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

describe('Scope.isStrict', () => {
	test('returns strict mode flag', () => {
		const strict = Testing.scope({ isStrict: true });
		const nonStrict = Testing.scope({ isStrict: false });
		expect(Scope.isStrict(strict)).toBe(true);
		expect(Scope.isStrict(nonStrict)).toBe(false);
	});
});
