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
 * Generate LLM instruction text explaining the input data format.
 * Tells the LLM: "The data you're about to receive is in TOON format, here's how to read it."
 */
export function generateInputInstruction(toonSample?: string): string {
	let instruction =
		'The following data is provided in TOON (Token-Oriented Object Notation) format. ' +
		'TOON is a compact, line-based format equivalent to JSON:\n' +
		'- Objects use indented key-value pairs (key: value)\n' +
		'- Tabular arrays declare fields once in the header, then list rows as CSV: key[N]{field1,field2}: followed by indented rows\n' +
		'- Primitive arrays use: key[N]: val1,val2,...\n' +
		'- Types are inferred: numbers, booleans (true/false), null, and strings (unquoted unless they contain special characters)\n' +
		'Parse this TOON data as you would JSON — same data model, just fewer tokens.';

	if (toonSample) {
		// Sanitize backtick sequences to prevent breaking out of the fenced code block
		const sanitized = toonSample.replace(/`{3,}/g, '` ` `');
		instruction += '\n\nExample of the data format:\n```\n' + sanitized + '\n```';
	}

	return instruction;
}

/**
 * Generate LLM instruction text explaining the expected output format.
 * Tells the LLM: "Respond in TOON format following these rules."
 */
export function generateOutputInstruction(): string {
	return (
		'Respond with your structured data in TOON (Token-Oriented Object Notation) format. Rules:\n' +
		'- Objects: one key-value pair per line, nested with 2-space indentation (key: value)\n' +
		'- Arrays of objects with the same fields: use tabular format — key[N]{field1,field2}: followed by indented CSV rows\n' +
		'- Primitive arrays: key[N]: val1,val2,...\n' +
		'- Strings only need quotes if they contain special characters (: , [ ] { }), look like numbers/booleans/null, or are empty\n' +
		'- Do NOT wrap the output in code blocks or add any text outside the TOON data\n' +
		'TOON is equivalent to JSON — same types (string, number, boolean, null, object, array) — just more compact.'
	);
}

export { encode, decode };
