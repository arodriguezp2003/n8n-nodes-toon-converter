# Node Usage Guide

The **TOON Converter** node provides two operations:

## Operation: Convert to TOON

Converts JSON data into TOON format. Use this before sending data to an LLM to reduce token usage.

### Source Options

| Source | Description |
|--------|-------------|
| **Input Item (JSON)** | Uses the incoming item's JSON data. Optionally specify a field name to convert only that field. |
| **JSON Expression** | Provide a JSON value via an n8n expression (e.g., `{{ $json.myData }}`). |
| **JSON String** | Paste or type raw JSON text directly. |

### Parameters

- **JSON Field** *(when Source = Input Item)*: Specify a field name to convert only that field. Leave empty to convert the entire item.
- **Output Field**: Name of the field in the output that will contain the TOON string. Default: `toon`.

### Example

**Input item:**
```json
{
  "users": [
    { "id": 1, "name": "Ada", "role": "engineer" },
    { "id": 2, "name": "Bob", "role": "designer" }
  ]
}
```

**Configuration:**
- Source: Input Item (JSON)
- JSON Field: `users`
- Output Field: `toon`

**Output item:**
```json
{
  "users": [...],
  "toon": "users[2]{id,name,role}:\n  1,Ada,engineer\n  2,Bob,designer"
}
```

---

## Operation: Convert to JSON

Parses TOON text back into JSON data. Use this when receiving TOON from an LLM or another system.

### Source Options

| Source | Description |
|--------|-------------|
| **Input Field** | Read TOON text from a field in the input item. |
| **TOON String** | Paste or type raw TOON text directly. |

### Output Modes

| Mode | Description |
|------|-------------|
| **Merge Into Item** | Merges the parsed JSON object fields directly into the output item. If the parsed result is an array or primitive, it is placed in a `data` field. |
| **Put in Field** | Stores the entire parsed result in a named field (default: `data`). |

### Parameters

- **Input Field** *(when Source = Input Field)*: Name of the field containing TOON text. Default: `toon`.
- **Output Field** *(when Output Mode = Put in Field)*: Name of the output field. Default: `data`.

---

## Options (both operations)

| Option | Default | Description |
|--------|---------|-------------|
| **Keep Source Fields** | `true` | Whether to include the original input fields in the output item alongside the conversion result. Set to `false` to output only the conversion result. |

---

## Error Handling

The node supports n8n's **Continue On Fail** setting. When enabled:
- Failed items produce an output with an `error` field containing the error message
- The workflow continues processing remaining items

Common errors:
- `Field "X" not found in input item` — the specified field doesn't exist
- `Field "X" must be a string containing TOON text` — the field value isn't a string (for TOON → JSON)
- JSON parse errors — invalid JSON input (for JSON → TOON with string source)
- TOON parse errors — malformed TOON syntax (for TOON → JSON)

## AI Agent Integration

The node has `usableAsTool: true`, which means n8n AI agents can use it directly. This enables workflows where:

1. An AI agent receives raw data
2. Converts it to TOON to reduce its own context usage
3. Processes the compact representation
4. Converts results back to JSON for downstream nodes
