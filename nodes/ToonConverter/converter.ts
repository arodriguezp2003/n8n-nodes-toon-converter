import { encode, decode } from '@toon-format/toon';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_RECURSION_DEPTH = 50;
const MAX_INPUT_SIZE = 10_000_000; // 10 MB

/**
 * Check if a key is a dangerous prototype-polluting key.
 */
export function isForbiddenKey(key: string): boolean {
	return FORBIDDEN_KEYS.has(key);
}

/**
 * Validate that a string input does not exceed the maximum allowed size.
 * Throws if the limit is exceeded.
 */
export function validateInputSize(input: string, label = 'Input'): void {
	if (input.length > MAX_INPUT_SIZE) {
		throw new Error(
			`${label} exceeds maximum allowed size of ${MAX_INPUT_SIZE} characters (got ${input.length})`,
		);
	}
}

/**
 * Recursively walk a value and parse any string that looks like
 * stringified JSON into its parsed form. This way TOON can compress
 * the inner structure instead of treating it as an opaque quoted string.
 *
 * Hardened against:
 * - Prototype pollution: skips __proto__, constructor, prototype keys
 * - Stack overflow: enforces a maximum recursion depth
 */
export function deepParseStringifiedJson(value: unknown, depth = 0): unknown {
	if (depth > MAX_RECURSION_DEPTH) return value;

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (
			(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
			(trimmed.startsWith('[') && trimmed.endsWith(']'))
		) {
			try {
				const parsed = JSON.parse(trimmed);
				return deepParseStringifiedJson(parsed, depth + 1);
			} catch {
				return value;
			}
		}
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => deepParseStringifiedJson(item, depth + 1));
	}

	if (typeof value === 'object' && value !== null) {
		const result: Record<string, unknown> = Object.create(null);
		for (const [k, v] of Object.entries(value)) {
			if (FORBIDDEN_KEYS.has(k)) continue;
			result[k] = deepParseStringifiedJson(v, depth + 1);
		}
		return result;
	}

	return value;
}

/**
 * Safely merge a parsed object into a target, skipping dangerous keys.
 */
export function safeMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): void {
	for (const [k, v] of Object.entries(source)) {
		if (FORBIDDEN_KEYS.has(k)) continue;
		target[k] = v;
	}
}

/**
 * Convert a JavaScript value to TOON string.
 * If autoParseJson is true, stringified JSON fields are expanded first.
 */
export function convertToToon(data: unknown, autoParseJson = false): string {
	const prepared = autoParseJson ? deepParseStringifiedJson(data) : data;
	return encode(prepared);
}

/**
 * Parse a TOON string back to a JavaScript value.
 */
export function convertToJson(toonText: string): unknown {
	validateInputSize(toonText, 'TOON input');
	return decode(toonText);
}

/**
 * Generate a format-only instruction telling the LLM how to read TOON data.
 * Does NOT include the data itself — the user places the data separately in the prompt.
 */
export function generateInputInstruction(): string {
	return (
		'The data provided below is in TOON (Token-Oriented Object Notation) format. ' +
		'TOON is a compact, line-based notation equivalent to JSON. Here is how to read it:\n\n' +
		'OBJECTS — key-value pairs, one per line. Nesting uses 2-space indentation:\n' +
		'  name: Ada\n' +
		'  address:\n' +
		'    city: Buenos Aires\n\n' +
		'TABULAR ARRAYS — arrays of uniform objects. Fields declared once in the header, rows as CSV:\n' +
		'  users[3]{id,name,role}:\n' +
		'    1,Ada,engineer\n' +
		'    2,Bob,designer\n' +
		'    3,Eve,analyst\n\n' +
		'PRIMITIVE ARRAYS — inline with declared length:\n' +
		'  tags[3]: foo,bar,baz\n\n' +
		'TYPES — values are inferred: numbers (42, 3.14), booleans (true/false), null, and strings ' +
		'(unquoted unless they contain special characters like : , [ ] { }).\n\n' +
		'Treat the TOON data exactly as you would JSON — same data model, just fewer tokens.'
	);
}

export { encode, decode };
