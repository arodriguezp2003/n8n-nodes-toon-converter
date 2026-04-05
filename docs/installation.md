# Installation

## From npm (recommended)

In your n8n instance, go to **Settings > Community Nodes** and install:

```
n8n-nodes-toon-converter
```

Or install via CLI:

```bash
# Self-hosted n8n
cd ~/.n8n
npm install n8n-nodes-toon-converter

# Then restart n8n
```

## From source (development)

```bash
git clone https://github.com/arodriguezp2003/n8n-nodes-toon-converter.git
cd n8n-nodes-toon-converter
npm install
npm run build
```

Then link it into your n8n installation:

```bash
# Option 1: npm link
cd n8n-nodes-toon-converter
npm link

cd ~/.n8n
npm link n8n-nodes-toon-converter

# Option 2: copy to custom extensions
cp -r dist/ ~/.n8n/custom/node_modules/n8n-nodes-toon-converter/

# Restart n8n
```

## Docker

Add to your Dockerfile:

```dockerfile
FROM n8nio/n8n:latest
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-toon-converter
```

Or mount as a volume:

```yaml
# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n
    volumes:
      - ./n8n-nodes-toon-converter:/home/node/.n8n/nodes/n8n-nodes-toon-converter
```

## Verify Installation

After restarting n8n, search for **"TOON"** in the node panel. You should see the **TOON Converter** node.

## Requirements

- n8n v1.0.0 or later
- Node.js v18 or later
