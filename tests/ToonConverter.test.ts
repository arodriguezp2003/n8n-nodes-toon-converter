import { describe, it, expect } from 'vitest';
import {
	encode,
	decode,
	deepParseStringifiedJson,
	convertToToon,
	convertToJson,
	generateInputInstruction,
	isForbiddenKey,
	safeMerge,
	validateInputSize,
} from '../nodes/ToonConverter/converter';

// ============================================================================
// deepParseStringifiedJson
// ============================================================================
describe('deepParseStringifiedJson', () => {
	it('parses a stringified JSON object inside a string field', () => {
		const input = { config: JSON.stringify({ theme: 'dark', lang: 'es' }) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.config).toEqual({ theme: 'dark', lang: 'es' });
	});

	it('parses a stringified JSON array inside a string field', () => {
		const input = { items: JSON.stringify([1, 2, 3]) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.items).toEqual([1, 2, 3]);
	});

	it('preserves double-stringified JSON as string (no quoted-string parsing)', () => {
		const inner = { key: 'value' };
		const doubleStringified = JSON.stringify(JSON.stringify(inner));
		const input = { data: doubleStringified };
		const result = deepParseStringifiedJson(input) as any;
		// Double-stringified starts with " not { — should be preserved as-is
		expect(typeof result.data).toBe('string');
	});

	it('leaves non-JSON strings untouched', () => {
		const input = { name: 'hello world', code: 'function() {}' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result).toEqual(input);
	});

	it('leaves strings that look like JSON but are invalid', () => {
		const input = { broken: '{not valid json}' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.broken).toBe('{not valid json}');
	});

	it('leaves invalid array-like strings untouched', () => {
		const input = { broken: '[not, valid, json]' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.broken).toBe('[not, valid, json]');
	});

	it('recursively parses nested objects', () => {
		const input = {
			level1: {
				level2: {
					payload: JSON.stringify({ deep: true }),
				},
			},
		};
		const result = deepParseStringifiedJson(input) as any;
		expect(result.level1.level2.payload).toEqual({ deep: true });
	});

	it('recursively parses inside arrays', () => {
		const input = [JSON.stringify({ a: 1 }), JSON.stringify([1, 2])];
		const result = deepParseStringifiedJson(input) as any;
		expect(result).toEqual([{ a: 1 }, [1, 2]]);
	});

	it('handles primitives passthrough', () => {
		expect(deepParseStringifiedJson(42)).toBe(42);
		expect(deepParseStringifiedJson(null)).toBe(null);
		expect(deepParseStringifiedJson(true)).toBe(true);
		expect(deepParseStringifiedJson(undefined)).toBe(undefined);
	});

	it('does not parse plain number or boolean strings', () => {
		expect(deepParseStringifiedJson('42')).toBe('42');
		expect(deepParseStringifiedJson('true')).toBe('true');
		expect(deepParseStringifiedJson('null')).toBe('null');
	});

	it('handles JSON with special characters (commas, colons, quotes)', () => {
		const inner = { msg: 'hello, world', note: 'has "quotes" and colons: yes' };
		const input = { payload: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.payload).toEqual(inner);
	});

	it('handles stringified JSON with nested arrays of objects', () => {
		const inner = { items: [{ a: 1 }, { b: 2 }], count: 2 };
		const input = { data: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual(inner);
	});

	it('handles stringified JSON with unicode', () => {
		const inner = { emoji: '🚀', text: '日本語テスト' };
		const input = { data: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual(inner);
	});

	it('handles empty stringified object and array', () => {
		const input = { obj: '{}', arr: '[]' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.obj).toEqual({});
		expect(result.arr).toEqual([]);
	});

	it('handles mixed fields: some stringified, some not', () => {
		const input = {
			name: 'Ada',
			age: 30,
			config: JSON.stringify({ theme: 'dark' }),
			tags: ['a', 'b'],
			nested: { meta: JSON.stringify([1, 2, 3]) },
		};
		const result = deepParseStringifiedJson(input) as any;
		expect(result.name).toBe('Ada');
		expect(result.age).toBe(30);
		expect(result.config).toEqual({ theme: 'dark' });
		expect(result.tags).toEqual(['a', 'b']);
		expect(result.nested.meta).toEqual([1, 2, 3]);
	});

	it('handles stringified JSON containing newlines and tabs', () => {
		const inner = { text: 'line1\nline2\ttab' };
		const input = { data: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual(inner);
	});

	it('handles stringified JSON with leading/trailing whitespace', () => {
		const input = { data: '  {"key":"value"}  ' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual({ key: 'value' });
	});
});

// ============================================================================
// convertToToon / convertToJson
// ============================================================================
describe('convertToToon', () => {
	it('converts a simple object', () => {
		const result = convertToToon({ name: 'Ada', age: 30 });
		expect(typeof result).toBe('string');
		expect(result).toContain('name: Ada');
		expect(result).toContain('age: 30');
	});

	it('converts with autoParseJson=true', () => {
		const data = { config: JSON.stringify({ theme: 'dark' }) };
		const withoutParse = convertToToon(data, false);
		const withParse = convertToToon(data, true);
		// Without parse: config is an escaped string in TOON
		expect(withoutParse).toContain('"');
		// With parse: config is expanded as nested object
		expect(withParse).toContain('config:');
		expect(withParse).toContain('theme: dark');
	});

	it('convertToJson parses TOON back', () => {
		const result = convertToJson('name: Ada\nage: 30');
		expect(result).toEqual({ name: 'Ada', age: 30 });
	});
});

// ============================================================================
// TOON encode/decode round-trip (library correctness sanity checks)
// ============================================================================
describe('TOON encode/decode round-trip', () => {
	const cases: Array<{ name: string; data: unknown }> = [
		{ name: 'simple object', data: { name: 'Ada', age: 30 } },
		{ name: 'nested object', data: { user: { id: 1, address: { city: 'BA' } } } },
		{ name: 'array of uniform objects', data: { rows: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }] } },
		{ name: 'primitive array', data: { tags: ['foo', 'bar', 'baz'] } },
		{ name: 'mixed array', data: { mix: [1, 'hello', true, null] } },
		{ name: 'empty object', data: {} },
		{ name: 'empty array', data: [] },
		{ name: 'boolean', data: true },
		{ name: 'number', data: 42 },
		{ name: 'null', data: null },
		{ name: 'unicode', data: { emoji: '🚀', cn: '你好' } },
		{ name: 'deep nesting', data: { a: { b: { c: { d: { e: 'deep' } } } } } },
		{
			name: 'field with stringified JSON (preserved as string)',
			data: { config: '{"theme":"dark"}' },
		},
	];

	for (const { name, data } of cases) {
		it(`round-trips: ${name}`, () => {
			const toon = encode(data);
			const decoded = decode(toon);
			expect(decoded).toEqual(data);
		});
	}
});

// ============================================================================
// Stringified JSON field handling (with vs without auto-parse)
// ============================================================================
describe('stringified JSON field handling', () => {
	it('without auto-parse: stringified JSON is preserved as opaque string', () => {
		const input = { name: 'test', config: JSON.stringify({ theme: 'dark', lang: 'es' }) };
		const toon = encode(input);
		const decoded = decode(toon) as any;
		expect(decoded.config).toBe('{"theme":"dark","lang":"es"}');
		expect(typeof decoded.config).toBe('string');
	});

	it('with auto-parse: stringified JSON is expanded before encoding', () => {
		const input = { name: 'test', config: JSON.stringify({ theme: 'dark', lang: 'es' }) };
		const parsed = deepParseStringifiedJson(input) as any;
		const toon = encode(parsed);
		const decoded = decode(toon) as any;
		expect(decoded.config).toEqual({ theme: 'dark', lang: 'es' });
		expect(typeof decoded.config).toBe('object');
	});

	it('auto-parse produces structurally richer TOON for stringified data', () => {
		const rows = [
			{ id: 1, meta: JSON.stringify({ score: 10, level: 'high' }) },
			{ id: 2, meta: JSON.stringify({ score: 20, level: 'low' }) },
		];
		const withoutParse = encode(rows);
		const withParse = encode(deepParseStringifiedJson(rows));
		// Without parse: meta is an opaque escaped string
		expect(withoutParse).toContain('"');
		// With parse: meta becomes structured TOON (no escaped JSON strings)
		expect(withParse).not.toContain('\\"');
	});

	it('preserves double-stringified JSON in TOON (no quoted-string unwrapping)', () => {
		const inner = { key: 'value' };
		const doubleStringified = JSON.stringify(JSON.stringify(inner));
		const input = { data: doubleStringified };
		const parsed = deepParseStringifiedJson(input) as any;
		// Without the quoted-string branch, double-stringify is preserved
		expect(typeof parsed.data).toBe('string');
	});

	it('handles stringified JSON with special characters', () => {
		const inner = {
			msg: 'hello, world',
			items: [{ a: 1 }, { b: 2 }],
			note: 'has "quotes" and colons: yes',
		};
		const input = { payload: JSON.stringify(inner) };

		const toonRaw = encode(input);
		const decodedRaw = decode(toonRaw) as any;
		expect(decodedRaw.payload).toBe(JSON.stringify(inner));

		const parsed = deepParseStringifiedJson(input) as any;
		const toonParsed = encode(parsed);
		const decodedParsed = decode(toonParsed) as any;
		expect(decodedParsed.payload).toEqual(inner);
	});

	it('handles tabular data where each row has a stringified JSON config', () => {
		const users = [
			{ id: 1, name: 'Ada', preferences: JSON.stringify({ theme: 'dark', notifications: true }) },
			{ id: 2, name: 'Bob', preferences: JSON.stringify({ theme: 'light', notifications: false }) },
			{ id: 3, name: 'Eve', preferences: JSON.stringify({ theme: 'auto', notifications: true }) },
		];

		const parsed = deepParseStringifiedJson({ users }) as any;
		expect(parsed.users[0].preferences).toEqual({ theme: 'dark', notifications: true });
		const toonParsed = encode(parsed);
		const decoded = decode(toonParsed) as any;
		expect(decoded.users[0].preferences).toEqual({ theme: 'dark', notifications: true });
		expect(decoded.users[1].preferences).toEqual({ theme: 'light', notifications: false });
	});
});

// ============================================================================
// Full round-trip: convertToToon → convertToJson
// ============================================================================
describe('full round-trip via converter functions', () => {
	it('simple object survives round-trip', () => {
		const original = { name: 'Ada', age: 30, active: true };
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('complex nested data survives round-trip', () => {
		const original = {
			users: [
				{ id: 1, name: 'Ada', tags: ['eng', 'lead'], meta: { level: 5 } },
				{ id: 2, name: 'Bob', tags: ['design'], meta: { level: 3 } },
			],
			count: 2,
			active: true,
		};
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('stringified JSON fields survive round-trip without auto-parse', () => {
		const original = {
			id: 1,
			config: JSON.stringify({ theme: 'dark', nested: { deep: true } }),
		};
		const toon = convertToToon(original, false);
		const result = convertToJson(toon) as any;
		expect(typeof result.config).toBe('string');
		expect(result.config).toBe(original.config);
	});

	it('stringified JSON fields are expanded with auto-parse', () => {
		const original = {
			id: 1,
			config: JSON.stringify({ theme: 'dark', nested: { deep: true } }),
		};
		const toon = convertToToon(original, true);
		const result = convertToJson(toon) as any;
		expect(typeof result.config).toBe('object');
		expect(result.config).toEqual({ theme: 'dark', nested: { deep: true } });
	});
});

// ============================================================================
// Edge cases
// ============================================================================
describe('edge cases', () => {
	it('handles empty object', () => {
		const toon = convertToToon({});
		const result = convertToJson(toon);
		expect(result).toEqual({});
	});

	it('handles empty array', () => {
		const toon = convertToToon([]);
		const result = convertToJson(toon);
		expect(result).toEqual([]);
	});

	it('handles null', () => {
		const toon = convertToToon(null);
		const result = convertToJson(toon);
		expect(result).toBe(null);
	});

	it('handles unicode', () => {
		const original = { emoji: '🚀🎉', japanese: '日本語', arabic: 'مرحبا' };
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('handles large arrays efficiently (100 rows)', () => {
		const rows = Array.from({ length: 100 }, (_, i) => ({
			id: i,
			name: `user_${i}`,
			score: i * 1.5,
		}));
		const toon = convertToToon(rows);
		const jsonStr = JSON.stringify(rows);
		// TOON should be more compact than JSON for tabular data
		expect(toon.length).toBeLessThan(jsonStr.length);
		const result = convertToJson(toon);
		expect(result).toEqual(rows);
	});

	it('handles deeply nested objects (5 levels)', () => {
		const original = { a: { b: { c: { d: { e: 'deep' } } } } };
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('handles object with many keys', () => {
		const original: Record<string, number> = {};
		for (let i = 0; i < 50; i++) {
			original[`key_${i}`] = i;
		}
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('handles real-world API response pattern', () => {
		const apiResponse = {
			status: 'success',
			data: {
				users: [
					{ id: 1, email: 'ada@test.com', profile: JSON.stringify({ bio: 'Engineer', links: ['github.com/ada'] }) },
					{ id: 2, email: 'bob@test.com', profile: JSON.stringify({ bio: 'Designer', links: ['dribbble.com/bob'] }) },
				],
				pagination: { page: 1, total: 100, hasNext: true },
			},
			meta: { requestId: 'abc-123', timestamp: '2026-01-01T00:00:00Z' },
		};

		// Without auto-parse: profile remains stringified
		const toon1 = convertToToon(apiResponse, false);
		const result1 = convertToJson(toon1) as any;
		expect(typeof result1.data.users[0].profile).toBe('string');

		// With auto-parse: profile is expanded
		const toon2 = convertToToon(apiResponse, true);
		const result2 = convertToJson(toon2) as any;
		expect(result2.data.users[0].profile).toEqual({ bio: 'Engineer', links: ['github.com/ada'] });
	});

	it('handles values that look like JSON but contain trailing content', () => {
		const input = { data: '{"valid": true} extra stuff' };
		const result = deepParseStringifiedJson(input) as any;
		// Should NOT parse because it doesn't end with }
		expect(result.data).toBe('{"valid": true} extra stuff');
	});

	it('handles stringified number-as-string edge case', () => {
		// "123" starts with a digit, not { or [, so should not be parsed
		const input = { val: '123' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.val).toBe('123');
	});
});

// ============================================================================
// LLM Instructions
// ============================================================================
describe('LLM instruction', () => {
	it('returns format-only explanation without any data', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('TOON');
		expect(instruction).toContain('Token-Oriented Object Notation');
	});

	it('explains object syntax with example', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('name: Ada');
		expect(instruction).toContain('address:');
		expect(instruction).toContain('city: Buenos Aires');
	});

	it('explains tabular array syntax with example', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('users[3]{id,name,role}:');
		expect(instruction).toContain('1,Ada,engineer');
	});

	it('explains primitive array syntax', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('tags[3]: foo,bar,baz');
	});

	it('explains type inference rules', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('numbers');
		expect(instruction).toContain('booleans');
		expect(instruction).toContain('null');
		expect(instruction).toContain('strings');
	});

	it('does NOT contain any user data', () => {
		const instruction = generateInputInstruction();
		// Should be a static instruction — no dynamic data
		const instruction2 = generateInputInstruction();
		expect(instruction).toBe(instruction2);
	});

	it('tells the LLM to treat TOON like JSON', () => {
		const instruction = generateInputInstruction();
		expect(instruction).toContain('same data model');
	});
});

// ============================================================================
// Security tests
// ============================================================================
describe('security: prototype pollution prevention', () => {
	it('deepParseStringifiedJson skips __proto__ keys', () => {
		const malicious = { __proto__: { polluted: true }, safe: 'value' };
		const result = deepParseStringifiedJson(malicious) as any;
		expect(result.safe).toBe('value');
		expect(result.__proto__).toBeUndefined();
		expect(({} as any).polluted).toBeUndefined();
	});

	it('deepParseStringifiedJson skips constructor key', () => {
		const malicious = { constructor: { prototype: { polluted: true } }, safe: 'ok' };
		const result = deepParseStringifiedJson(malicious) as any;
		expect(result.safe).toBe('ok');
		expect(result.constructor).toBeUndefined();
	});

	it('deepParseStringifiedJson skips prototype key', () => {
		const malicious = { prototype: { polluted: true }, safe: 'ok' };
		const result = deepParseStringifiedJson(malicious) as any;
		expect(result.safe).toBe('ok');
		expect(result.prototype).toBeUndefined();
	});

	it('deepParseStringifiedJson blocks __proto__ inside stringified JSON', () => {
		const payload = JSON.stringify({ __proto__: { isAdmin: true }, name: 'test' });
		const input = { data: payload };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data.name).toBe('test');
		expect(result.data.__proto__).toBeUndefined();
		expect(({} as any).isAdmin).toBeUndefined();
	});

	it('safeMerge skips __proto__ keys', () => {
		const target: Record<string, unknown> = { existing: true };
		const source = { __proto__: { polluted: true }, safe: 'value' };
		safeMerge(target, source);
		expect(target.safe).toBe('value');
		expect((target as any).__proto__).toBe(Object.prototype); // unchanged
		expect(({} as any).polluted).toBeUndefined();
	});

	it('safeMerge skips constructor and prototype keys', () => {
		const target: Record<string, unknown> = {};
		const source = { constructor: 'bad', prototype: 'bad', ok: 'good' };
		safeMerge(target, source);
		expect(target.ok).toBe('good');
		// constructor exists on target via inheritance (Object.prototype), but safeMerge must NOT
		// overwrite it with the attacker value 'bad'
		expect(target.constructor).toBe(Object);
		expect(Object.hasOwn(target, 'constructor')).toBe(false);
		expect(Object.hasOwn(target, 'prototype')).toBe(false);
	});

	it('isForbiddenKey correctly identifies dangerous keys', () => {
		expect(isForbiddenKey('__proto__')).toBe(true);
		expect(isForbiddenKey('constructor')).toBe(true);
		expect(isForbiddenKey('prototype')).toBe(true);
		expect(isForbiddenKey('name')).toBe(false);
		expect(isForbiddenKey('data')).toBe(false);
		expect(isForbiddenKey('toon')).toBe(false);
	});

	it('TOON decode + safeMerge does not pollute prototype', () => {
		// Build TOON text that contains a __proto__ key manually
		const toonText = '__proto__:\n  polluted: true\nname: Ada';
		const parsed = decode(toonText) as Record<string, unknown>;
		const target: Record<string, unknown> = {};
		safeMerge(target, parsed);
		expect(({} as any).polluted).toBeUndefined();
		expect(target.name).toBe('Ada');
		// __proto__ from TOON should be blocked
		expect(Object.hasOwn(target, '__proto__')).toBe(false);
	});
});

describe('security: recursion depth limit', () => {
	it('deepParseStringifiedJson stops at max depth and returns value as-is', () => {
		// Create a deeply nested stringified JSON (60 levels, above the limit of 50)
		let nested: unknown = { leaf: true };
		for (let i = 0; i < 60; i++) {
			nested = { level: nested };
		}
		// Should not throw stack overflow
		const result = deepParseStringifiedJson(nested);
		expect(result).toBeDefined();
	});

	it('deeply nested object structures do not cause stack overflow', () => {
		// Build 100-level deep object nesting (above 50 limit)
		let nested: unknown = { leaf: true };
		for (let i = 0; i < 100; i++) {
			nested = { level: nested };
		}
		const input = { data: JSON.stringify(nested) };
		// The stringified JSON is parsed once (depth+1), then object recursion
		// stops at depth 50. Should not throw.
		const result = deepParseStringifiedJson(input);
		expect(result).toBeDefined();
	});
});

describe('security: input size validation', () => {
	it('validateInputSize allows normal-sized input', () => {
		expect(() => validateInputSize('hello world')).not.toThrow();
	});

	it('validateInputSize throws on oversized input', () => {
		const huge = 'x'.repeat(10_000_001);
		expect(() => validateInputSize(huge)).toThrow('exceeds maximum allowed size');
	});

	it('validateInputSize includes custom label in error', () => {
		const huge = 'x'.repeat(10_000_001);
		expect(() => validateInputSize(huge, 'TOON input')).toThrow('TOON input exceeds');
	});

	it('convertToJson rejects oversized TOON input', () => {
		const huge = 'key: ' + 'x'.repeat(10_000_001);
		expect(() => convertToJson(huge)).toThrow('exceeds maximum allowed size');
	});
});

describe('security: LLM instruction is static (no injection surface)', () => {
	it('generateInputInstruction contains no dynamic content', () => {
		// Since the instruction is fully static (no user data), there is no
		// prompt injection surface — calling it multiple times yields identical output
		const a = generateInputInstruction();
		const b = generateInputInstruction();
		expect(a).toBe(b);
	});

	it('instruction does not contain backtick fences that could be exploited', () => {
		const instruction = generateInputInstruction();
		expect(instruction).not.toContain('```');
	});
});

describe('security: no silent string mutation via quoted-string parsing', () => {
	it('does not parse quoted string values like "42" into number strings', () => {
		// A string value of '"42"' should NOT be parsed — it would silently
		// strip the quotes and change the value
		const input = { data: '"42"' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toBe('"42"');
	});

	it('does not parse quoted string values like "hello"', () => {
		const input = { data: '"hello"' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toBe('"hello"');
	});

	it('does not parse double-stringified JSON (starts with quote)', () => {
		const doubleStr = JSON.stringify(JSON.stringify({ key: 'value' }));
		const input = { data: doubleStr };
		const result = deepParseStringifiedJson(input) as any;
		// Should be preserved as-is since it starts with "
		expect(result.data).toBe(doubleStr);
	});
});

describe('security: global prototype is never polluted after all tests', () => {
	it('Object.prototype has no extra properties', () => {
		const base = Object.getOwnPropertyNames(Object.prototype);
		const unexpected = base.filter(
			(k) => !['constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
				'toString', 'valueOf', 'toLocaleString', '__defineGetter__', '__defineSetter__',
				'__lookupGetter__', '__lookupSetter__', '__proto__'].includes(k),
		);
		expect(unexpected).toEqual([]);
	});
});
