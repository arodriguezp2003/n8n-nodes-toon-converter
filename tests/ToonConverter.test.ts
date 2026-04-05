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
		const input = { settings: JSON.stringify({ color: 'blue', size: 'large' }) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.settings).toEqual({ color: 'blue', size: 'large' });
	});

	it('parses a stringified JSON array inside a string field', () => {
		const input = { scores: JSON.stringify([10, 20, 30]) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.scores).toEqual([10, 20, 30]);
	});

	it('preserves double-stringified JSON as string (no quoted-string parsing)', () => {
		const inner = { flavor: 'vanilla' };
		const doubleStringified = JSON.stringify(JSON.stringify(inner));
		const input = { data: doubleStringified };
		const result = deepParseStringifiedJson(input) as any;
		// Double-stringified starts with " not { — should be preserved as-is
		expect(typeof result.data).toBe('string');
	});

	it('leaves non-JSON strings untouched', () => {
		const input = { greeting: 'good morning', snippet: 'for (;;) {}' };
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
					payload: JSON.stringify({ enabled: true }),
				},
			},
		};
		const result = deepParseStringifiedJson(input) as any;
		expect(result.level1.level2.payload).toEqual({ enabled: true });
	});

	it('recursively parses inside arrays', () => {
		const input = [JSON.stringify({ x: 7 }), JSON.stringify([4, 5])];
		const result = deepParseStringifiedJson(input) as any;
		expect(result).toEqual([{ x: 7 }, [4, 5]]);
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
		const inner = { greeting: 'hello, world', remark: 'has "quotes" and colons: yes' };
		const input = { payload: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.payload).toEqual(inner);
	});

	it('handles stringified JSON with nested arrays of objects', () => {
		const inner = { products: [{ sku: 'A1' }, { sku: 'B2' }], total: 2 };
		const input = { data: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual(inner);
	});

	it('handles stringified JSON with unicode', () => {
		const inner = { icon: '🌧️', city: '東京の天気' };
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
			city: 'Tokyo',
			population: 14000000,
			weather: JSON.stringify({ condition: 'sunny' }),
			districts: ['Shibuya', 'Shinjuku'],
			nested: { forecast: JSON.stringify([22, 24, 19]) },
		};
		const result = deepParseStringifiedJson(input) as any;
		expect(result.city).toBe('Tokyo');
		expect(result.population).toBe(14000000);
		expect(result.weather).toEqual({ condition: 'sunny' });
		expect(result.districts).toEqual(['Shibuya', 'Shinjuku']);
		expect(result.nested.forecast).toEqual([22, 24, 19]);
	});

	it('handles stringified JSON containing newlines and tabs', () => {
		const inner = { recipe: 'step1\nstep2\tstir' };
		const input = { data: JSON.stringify(inner) };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual(inner);
	});

	it('handles stringified JSON with leading/trailing whitespace', () => {
		const input = { data: '  {"flavor":"mint"}  ' };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data).toEqual({ flavor: 'mint' });
	});
});

// ============================================================================
// convertToToon / convertToJson
// ============================================================================
describe('convertToToon', () => {
	it('converts a simple object', () => {
		const result = convertToToon({ city: 'Berlin', population: 3748148 });
		expect(typeof result).toBe('string');
		expect(result).toContain('city: Berlin');
		expect(result).toContain('population: 3748148');
	});

	it('converts with autoParseJson=true', () => {
		const data = { weather: JSON.stringify({ condition: 'sunny' }) };
		const withoutParse = convertToToon(data, false);
		const withParse = convertToToon(data, true);
		// Without parse: weather is an escaped string in TOON
		expect(withoutParse).toContain('"');
		// With parse: weather is expanded as nested object
		expect(withParse).toContain('weather:');
		expect(withParse).toContain('condition: sunny');
	});

	it('convertToJson parses TOON back', () => {
		const result = convertToJson('city: Berlin\npopulation: 3748148');
		expect(result).toEqual({ city: 'Berlin', population: 3748148 });
	});
});

// ============================================================================
// TOON encode/decode round-trip (library correctness sanity checks)
// ============================================================================
describe('TOON encode/decode round-trip', () => {
	const cases: Array<{ name: string; data: unknown }> = [
		{ name: 'simple object', data: { city: 'Berlin', population: 3748148 } },
		{ name: 'nested object', data: { order: { id: 1, shipping: { country: 'DE' } } } },
		{ name: 'array of uniform objects', data: { rows: [{ sku: 'A1', price: 9.99 }, { sku: 'B2', price: 14.50 }] } },
		{ name: 'primitive array', data: { ingredients: ['flour', 'sugar', 'eggs'] } },
		{ name: 'mixed array', data: { mix: [1, 'hello', true, null] } },
		{ name: 'empty object', data: {} },
		{ name: 'empty array', data: [] },
		{ name: 'boolean', data: true },
		{ name: 'number', data: 42 },
		{ name: 'null', data: null },
		{ name: 'unicode', data: { icon: '🌧️', greeting: '你好' } },
		{ name: 'deep nesting', data: { a: { b: { c: { d: { e: 'deep' } } } } } },
		{
			name: 'field with stringified JSON (preserved as string)',
			data: { weather: '{"condition":"rainy"}' },
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
		const input = { label: 'forecast', details: JSON.stringify({ tempC: 22, wind: 'NW' }) };
		const toon = encode(input);
		const decoded = decode(toon) as any;
		expect(decoded.details).toBe('{"tempC":22,"wind":"NW"}');
		expect(typeof decoded.details).toBe('string');
	});

	it('with auto-parse: stringified JSON is expanded before encoding', () => {
		const input = { label: 'forecast', details: JSON.stringify({ tempC: 22, wind: 'NW' }) };
		const parsed = deepParseStringifiedJson(input) as any;
		const toon = encode(parsed);
		const decoded = decode(toon) as any;
		expect(decoded.details).toEqual({ tempC: 22, wind: 'NW' });
		expect(typeof decoded.details).toBe('object');
	});

	it('auto-parse produces structurally richer TOON for stringified data', () => {
		const rows = [
			{ sku: 'A1', specs: JSON.stringify({ weight: 500, color: 'red' }) },
			{ sku: 'B2', specs: JSON.stringify({ weight: 300, color: 'blue' }) },
		];
		const withoutParse = encode(rows);
		const withParse = encode(deepParseStringifiedJson(rows));
		// Without parse: specs is an opaque escaped string
		expect(withoutParse).toContain('"');
		// With parse: specs becomes structured TOON (no escaped JSON strings)
		expect(withParse).not.toContain('\\"');
	});

	it('preserves double-stringified JSON in TOON (no quoted-string unwrapping)', () => {
		const inner = { flavor: 'vanilla' };
		const doubleStringified = JSON.stringify(JSON.stringify(inner));
		const input = { data: doubleStringified };
		const parsed = deepParseStringifiedJson(input) as any;
		// Without the quoted-string branch, double-stringify is preserved
		expect(typeof parsed.data).toBe('string');
	});

	it('handles stringified JSON with special characters', () => {
		const inner = {
			greeting: 'hello, world',
			ingredients: [{ name: 'flour' }, { name: 'sugar' }],
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
		const players = [
			{ id: 1, name: 'Carlos', stats: JSON.stringify({ goals: 12, assists: 5 }) },
			{ id: 2, name: 'Mika', stats: JSON.stringify({ goals: 8, assists: 11 }) },
			{ id: 3, name: 'Priya', stats: JSON.stringify({ goals: 15, assists: 3 }) },
		];

		const parsed = deepParseStringifiedJson({ players }) as any;
		expect(parsed.players[0].stats).toEqual({ goals: 12, assists: 5 });
		const toonParsed = encode(parsed);
		const decoded = decode(toonParsed) as any;
		expect(decoded.players[0].stats).toEqual({ goals: 12, assists: 5 });
		expect(decoded.players[1].stats).toEqual({ goals: 8, assists: 11 });
	});
});

// ============================================================================
// Full round-trip: convertToToon → convertToJson
// ============================================================================
describe('full round-trip via converter functions', () => {
	it('simple object survives round-trip', () => {
		const original = { city: 'Berlin', population: 3748148, coastal: false };
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('complex nested data survives round-trip', () => {
		const original = {
			products: [
				{ sku: 'A1', name: 'Widget', tags: ['sale', 'new'], pricing: { amount: 9.99 } },
				{ sku: 'B2', name: 'Gadget', tags: ['clearance'], pricing: { amount: 4.50 } },
			],
			count: 2,
			inStock: true,
		};
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('stringified JSON fields survive round-trip without auto-parse', () => {
		const original = {
			id: 1,
			recipe: JSON.stringify({ servings: 4, steps: { first: 'preheat oven' } }),
		};
		const toon = convertToToon(original, false);
		const result = convertToJson(toon) as any;
		expect(typeof result.recipe).toBe('string');
		expect(result.recipe).toBe(original.recipe);
	});

	it('stringified JSON fields are expanded with auto-parse', () => {
		const original = {
			id: 1,
			recipe: JSON.stringify({ servings: 4, steps: { first: 'preheat oven' } }),
		};
		const toon = convertToToon(original, true);
		const result = convertToJson(toon) as any;
		expect(typeof result.recipe).toBe('object');
		expect(result.recipe).toEqual({ servings: 4, steps: { first: 'preheat oven' } });
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
		const original = { icon: '🌧️🎵', japanese: '東京タワー', arabic: 'مرحبا' };
		const toon = convertToToon(original);
		const result = convertToJson(toon);
		expect(result).toEqual(original);
	});

	it('handles large arrays efficiently (100 rows)', () => {
		const rows = Array.from({ length: 100 }, (_, i) => ({
			id: i,
			product: `item_${i}`,
			price: i * 2.5,
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
				orders: [
					{ id: 1, customer: 'alice@shop.com', items: JSON.stringify({ product: 'Widget', qty: 3 }) },
					{ id: 2, customer: 'bob@shop.com', items: JSON.stringify({ product: 'Gadget', qty: 1 }) },
				],
				pagination: { page: 1, total: 100, hasNext: true },
			},
			meta: { requestId: 'xyz-789', timestamp: '2026-01-01T00:00:00Z' },
		};

		// Without auto-parse: items remains stringified
		const toon1 = convertToToon(apiResponse, false);
		const result1 = convertToJson(toon1) as any;
		expect(typeof result1.data.orders[0].items).toBe('string');

		// With auto-parse: items is expanded
		const toon2 = convertToToon(apiResponse, true);
		const result2 = convertToJson(toon2) as any;
		expect(result2.data.orders[0].items).toEqual({ product: 'Widget', qty: 3 });
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
		const payload = JSON.stringify({ __proto__: { isAdmin: true }, name: 'weather-api' });
		const input = { data: payload };
		const result = deepParseStringifiedJson(input) as any;
		expect(result.data.name).toBe('weather-api');
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
		expect(isForbiddenKey('city')).toBe(false);
		expect(isForbiddenKey('data')).toBe(false);
		expect(isForbiddenKey('toon')).toBe(false);
	});

	it('TOON decode + safeMerge does not pollute prototype', () => {
		// Build TOON text that contains a __proto__ key manually
		const toonText = '__proto__:\n  polluted: true\ncity: Berlin';
		const parsed = decode(toonText) as Record<string, unknown>;
		const target: Record<string, unknown> = {};
		safeMerge(target, parsed);
		expect(({} as any).polluted).toBeUndefined();
		expect(target.city).toBe('Berlin');
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
		const doubleStr = JSON.stringify(JSON.stringify({ flavor: 'vanilla' }));
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
