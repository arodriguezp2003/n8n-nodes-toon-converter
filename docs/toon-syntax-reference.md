# TOON Syntax Reference

Quick reference for the TOON (Token-Oriented Object Notation) format. Full spec: [github.com/toon-format/spec](https://github.com/toon-format/spec)

## Objects

Key-value pairs, one per line. Nested objects use indentation (2 spaces).

```
name: Ada
age: 30
address:
  city: Buenos Aires
  country: Argentina
```

Equivalent JSON:
```json
{"name": "Ada", "age": 30, "address": {"city": "Buenos Aires", "country": "Argentina"}}
```

## Primitive Arrays

Inline format with declared length:

```
tags[3]: foo,bar,baz
```

Equivalent JSON:
```json
{"tags": ["foo", "bar", "baz"]}
```

## Tabular Arrays (Arrays of Uniform Objects)

Field names declared once in the header, rows as CSV-like lines:

```
users[3]{id,name,email}:
  1,Ada,ada@example.com
  2,Bob,bob@example.com
  3,Eve,eve@example.com
```

Equivalent JSON:
```json
{
  "users": [
    {"id": 1, "name": "Ada", "email": "ada@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"},
    {"id": 3, "name": "Eve", "email": "eve@example.com"}
  ]
}
```

## Mixed Arrays

Non-uniform arrays use hyphen-prefixed items:

```
items[3]:
  - 42
  - hello
  - nested:
      key: value
```

## Primitives

| TOON | Type |
|------|------|
| `true` / `false` | Boolean |
| `null` | Null |
| `42`, `3.14`, `-7` | Number |
| `hello world` | String (unquoted) |
| `"has:colons"` | String (quoted — needed when value contains special chars) |

## When Strings Need Quoting

Strings must be quoted when they:
- Contain `:`, `,`, `[`, `]`, `{`, `}`
- Look like `true`, `false`, `null`, or a number
- Are empty
- Have leading or trailing whitespace

## Escape Sequences

Only 5: `\\`, `\"`, `\n`, `\r`, `\t`

## Delimiters

Arrays support three delimiters (declared in header):
- `,` comma (default)
- `\t` tab
- `|` pipe

Example with pipe:
```
data[2|]{name,bio}:
  Ada|Engineer and mathematician
  Bob|Designer and artist
```

## Empty Values

- Empty object: produces no output
- Empty array: `key[0]:`
- Empty string in array: requires quoting `""`

## File Extension

`.toon`

## Media Type

`text/toon`
