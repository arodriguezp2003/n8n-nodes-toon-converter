# What is TOON?

**TOON** stands for **Token-Oriented Object Notation**. It is a data serialization format designed to reduce token usage when passing structured data to Large Language Models (LLMs).

## Why TOON?

When you send structured data (like database records, API responses, or configuration) to an LLM, every token costs money and counts against context limits. JSON is verbose — it repeats key names for every object in an array, requires quotes around every string, and uses braces and brackets extensively.

TOON encodes the same data as JSON but uses a more compact, line-oriented, indentation-based syntax. The result:

| Format | Accuracy (LLM benchmark) | Avg Tokens |
|--------|--------------------------|------------|
| **TOON** | **76.4%** | **2,759** |
| JSON (compact) | 73.7% | 3,104 |
| YAML | 74.5% | 3,749 |
| JSON (formatted) | 75.0% | 4,587 |

*Benchmark: 209 data retrieval questions across 4 LLM models. Source: [toonformat.dev](https://toonformat.dev/)*

**Key takeaway**: TOON uses **30-60% fewer tokens** than JSON while achieving **higher LLM accuracy** on data retrieval tasks.

## When to Use TOON

TOON shines when you are:

- Sending structured data to LLMs via n8n AI nodes
- Passing large arrays of objects (e.g., database query results) to AI agents
- Building workflows where token cost matters (production AI pipelines)
- Working with tabular data that has repeated key names

## When NOT to Use TOON

- When the downstream system expects JSON (APIs, databases, webhooks)
- For human-facing output where JSON readability is preferred
- When data is deeply nested and non-uniform (TOON's advantage is smaller here)

## Lossless Conversion

The conversion between JSON and TOON is **lossless and bidirectional**. Converting JSON → TOON → JSON produces the same data. All JSON types are preserved: strings, numbers, booleans, null, objects, and arrays.

## Official Resources

- [TOON Official Site](https://toonformat.dev/)
- [TOON Specification](https://github.com/toon-format/spec)
- [TOON TypeScript SDK](https://github.com/toon-format/toon)
