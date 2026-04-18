# Intellegode

> Fight vibe coding. Understand your own code.

Intellegode is a VS Code extension that uses a local LLM to quiz you on code you just wrote or AI-generated — making sure you actually understand it before moving on. Fully local, no cloud, no subscriptions.

## How it works

1. Highlight a block of code in your editor
2. Press `Ctrl+Alt+Q` (Windows/Linux) or `Cmd+Alt+Q` (Mac) to trigger Intellegode
   - Alternatively: `Ctrl+Shift+P` → "Intellegode: Quiz Me"
3. Answer the comprehension question in the sidebar
4. Find out if you actually get it

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/) installed locally or [Docker](https://www.docker.com/) (for Ollama)
- [VS Code](https://code.visualstudio.com/) v1.110+

## Setup

**1. Install the Extension**
Search for **Intellegode** in the VS Code Extensions Marketplace and click Install.

**2. Start Ollama**

If you use Docker:
```bash
docker-compose up -d
```

If you installed Ollama locally (for example on Fedora/Linux):
```bash
ollama serve
```

**3. Pull the model**

If you use Docker:
```bash
docker exec intellegode-ollama ollama pull qwen3.5:4b
```

If you run Ollama locally:
```bash
ollama pull qwen3.5:4b
```

**5. Run the extension**

Highlight a snippet of code and hit **Ctrl+Alt+Q** to start your session!

## Tech Stack

- VS Code Extension API (TypeScript)
- Ollama (local LLM runtime via Docker)
- Qwen3.5 4B (code comprehension model)

## Configuration

### Extension Settings

In VS Code, go to **File → Preferences → Settings** and search for "Intellegode":

- **`intellegode.ollamaUrl`** — Base URL for Ollama server (default: `http://localhost:11434`)
- **`intellegode.defaultModel`** — Model to use (default: `qwen3.5:4b`)

### Environment Variables (for development)

When running the extension in development mode (`F5`), you can set environment variables:

- **`INTELLEGODE_OLLAMA_FORCE_CPU=1`** — Force CPU-only mode (useful for low-VRAM GPUs)
- **`INTELLEGODE_OLLAMA_REQUEST_TIMEOUT_MS=120000`** — Custom request timeout in milliseconds

**Example:** To test with CPU-only mode, use the "Run Extension" launch config (default in `.vscode/launch.json`).

## Troubleshooting

### ❌ Extension hangs / System freezes

**Cause:** Ollama is trying to load the model on GPU but running out of VRAM.

**Solution for 4GB VRAM or less:**
1. **In VS Code:** Press `Ctrl+Shift+D` → Select "Run Extension (GPU)" dropdown → Choose "Run Extension"
   - The default "Run Extension" already forces CPU mode
2. **Or manually:** Set environment variable before launching:
   ```bash
   export INTELLEGODE_OLLAMA_FORCE_CPU=1
   code .
   F5
   ```
3. **Performance note:** CPU-only mode is slower (10-30s per question) but stable on 4GB VRAM systems

### ❌ "Cannot connect to Ollama"

**Solution:**
1. Make sure Ollama is running:
   - Docker: `docker-compose up -d`
   - Local: `ollama serve` in a separate terminal
2. Verify Ollama is accessible: `curl http://localhost:11434/api/tags`
3. Check your `intellegode.ollamaUrl` setting matches where Ollama is running

### ❌ "Model not found"

**Solution:**
```bash
ollama pull qwen3.5:4b
```

### ❌ Request timeout

**Cause:** Model is still loading (cold start) or your system is too slow.

**Solution:**
- Wait a few seconds and try again (model caches after first load)
- Increase timeout: Set `INTELLEGODE_OLLAMA_REQUEST_TIMEOUT_MS=180000` (3 minutes)
- Use CPU-only mode if freezing occurs

## Roadmap

- [ ] v1 — Quizzer (highlight → question → answer)
- [ ] v2 — Concept Debt Tracker
- [ ] v3 — Ownership Map
- [ ] v4 — Reconstruction Challenges
