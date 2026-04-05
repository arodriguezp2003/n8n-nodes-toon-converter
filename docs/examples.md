# Practical Examples

## Example 1: Compress Database Results Before LLM

**Use case**: You query a database with 100 rows and want to send them to an LLM for analysis. Using TOON instead of JSON can save 40-60% of tokens.

```
[PostgreSQL Node] → [TOON Converter: Convert to TOON] → [OpenAI Node]
```

**TOON Converter config:**
- Operation: `Convert to TOON`
- Source: `Input Item (JSON)`
- JSON Field: *(empty — convert entire item)*
- Output Field: `toon`

Then in the OpenAI node, reference `{{ $json.toon }}` in your prompt.

---

## Example 2: Parse LLM Output in TOON Format

**Use case**: You instruct the LLM to respond in TOON format to save output tokens, then parse it back to JSON for downstream processing.

```
[OpenAI Node] → [TOON Converter: Convert to JSON] → [Webhook Response]
```

**Prompt to LLM:**
> Respond with the data in TOON format (Token-Oriented Object Notation).

**TOON Converter config:**
- Operation: `Convert to JSON`
- TOON Source: `Input Field`
- Input Field: `text` *(or wherever the LLM response is)*
- Output Mode: `Merge Into Item`

---

## Example 3: Round-Trip Conversion

**Use case**: Convert data to TOON for storage/transfer, then back to JSON.

```
[HTTP Request] → [TOON Converter: Convert to TOON] → [Set Node: store toon] → [TOON Converter: Convert to JSON]
```

This is lossless — the final JSON output is identical to the original input.

---

## Example 4: Batch Processing with AI Agent

**Use case**: Process multiple records through an AI agent efficiently.

```
[Spreadsheet Node] → [TOON Converter: Convert to TOON] → [AI Agent] → [TOON Converter: Convert to JSON] → [Google Sheets]
```

**JSON input (1 row):**
```json
{
  "products": [
    {"sku": "A001", "name": "Widget", "price": 9.99, "stock": 150},
    {"sku": "A002", "name": "Gadget", "price": 24.99, "stock": 0},
    {"sku": "A003", "name": "Doohickey", "price": 4.50, "stock": 42}
  ]
}
```

**TOON output (much more compact):**
```
products[3]{sku,name,price,stock}:
  A001,Widget,9.99,150
  A002,Gadget,24.99,0
  A003,Doohickey,4.5,42
```

Token savings: ~55% fewer tokens for this tabular data.

---

## Data Format Comparison

Here's the same data in JSON vs TOON to visualize the savings:

### JSON (149 tokens)
```json
{
  "hikes": [
    {"id": 1, "name": "Blue Lake Trail", "distanceKm": 7.5, "companion": "ana", "wasSunny": true},
    {"id": 2, "name": "Ridge Overlook", "distanceKm": 9.2, "companion": "luis", "wasSunny": false},
    {"id": 3, "name": "Wildflower Loop", "distanceKm": 5.1, "companion": "sam", "wasSunny": true}
  ]
}
```

### TOON (45 tokens)
```
hikes[3]{id,name,distanceKm,companion,wasSunny}:
  1,Blue Lake Trail,7.5,ana,true
  2,Ridge Overlook,9.2,luis,false
  3,Wildflower Loop,5.1,sam,true
```

**70% fewer tokens** for tabular data like this.
