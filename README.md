<div align="center">
  <img src="images/logo.png" alt="Intellegode Logo" height="80" />
  <img src="images/logo_title.png" alt="Intellegode Title" height="80" />
  <br/><br/>
  <p><strong>Fight vibe coding. Understand your own code.</strong></p>
</div>

---

**Intellegode** is a VS Code extension that leverages a local Large Language Model to quiz you on code you just wrote or AI-generated—ensuring deep comprehension before you move on. Everything runs strictly local. No cloud telemetry, no subscriptions.

## How It Works

1. Highlight a block of code in your editor.
2. Press `Ctrl+Alt+Q` (Windows/Linux) or `Cmd+Alt+Q` (Mac) to trigger Intellegode.
   - Alternatively: Open the Command Palette (`Ctrl+Shift+P`) and run `Intellegode: Quiz Me`.
3. Answer the comprehension question in the sidebar.
4. Receive immediate, context-aware feedback from the AI to validate your grasp of the logic.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/) installed natively or via [Docker](https://www.docker.com/)
- [VS Code](https://code.visualstudio.com/) v1.110+

## Installation & Setup

**1. Install the Extension**
Search for **Intellegode** in the VS Code Extensions Marketplace and select Install.

**2. Start Ollama**
Ensure the Ollama server is running in the background. If you installed Ollama natively:
```bash
ollama serve
```

**3. Pull the Language Model**
Intellegode requires an LLM to operate. By default it uses Ollama's Qwen model. Run the following command in your terminal:
```bash
ollama pull qwen3.5:4b
```
*(See "Recommended Models" below for alternatives if you have a powerful GPU or want to use OpenAI/Groq).*

**4. Start Your First Session**
Highlight a snippet of code in your editor and press **Ctrl+Alt+Q** to begin your session.

## Architecture

- **VS Code Extension API** (TypeScript)
- **Multi-Provider LLM Layer** (Ollama, OpenAI-Compatible Endpoints)
- **Default Model:** Qwen3.5 4B (Optimized for fast local inference)

## Configuration

In VS Code, navigate to **File > Preferences > Settings** and search for `Intellegode` to configure:

### LLM Provider Settings
- **`intellegode.provider`**: Choose between `ollama` (default) or `openai-compatible`.
- **`intellegode.apiBaseUrl`**: Base URL for cloud APIs (e.g., `https://api.openai.com` or `https://api.groq.com/openai/v1`).
- **`intellegode.defaultModel`**: Target model mapping (e.g., `qwen3.5:4b` or `gpt-4o-mini`).

*Note: For OpenAI-compatible providers, you must set your API key by running the command `Intellegode: Set API Key` from the command palette. Your key is securely stored in your OS keychain.*

### Ollama-Specific Settings
- **`intellegode.ollamaUrl`**: Base URL for your local Ollama server (Default: `http://localhost:11434`).

### Developer Environment Variables

When running the extension in development mode with Ollama, the following flags are supported:

- `INTELLEGODE_OLLAMA_FORCE_CPU=1` — Forces CPU-only execution (Beneficial for low-VRAM environments)
- `INTELLEGODE_OLLAMA_REQUEST_TIMEOUT_MS=120000` — Configures the request timeout buffer in milliseconds

## Recommended Models

### Local Inference (Ollama)
- **4GB VRAM (Laptops):** `qwen3.5:4b` (Default) — Very fast, highly capable for code comprehension.
- **8GB VRAM:** `qwen3:8b` or `llama3.1:8b` — Better reasoning, slightly slower.
- **16GB+ VRAM:** `deepseek-r1:14b` — Incredible coding logic, high latency.

### Cloud Inference (OpenAI-Compatible)
Set `intellegode.provider` to `openai-compatible`.
- **OpenAI:** URL: `https://api.openai.com` | Model: `gpt-4o-mini` (Fast and extremely cheap).
- **Groq:** URL: `https://api.groq.com/openai/v1` | Model: `llama-3.1-8b-instant` (Lightning fast).
- **Together AI:** URL: `https://api.together.xyz/v1` | Model: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`.

## Troubleshooting

### Extension Hangs / System Freezes
**Cause**: Ollama is attempting to load the language model into GPU VRAM but running out of allocation space.
**Solution**: 
If your hardware has 4GB VRAM or less, force CPU mode. You can set the environment variable before launching VS Code from the terminal:
```bash
export INTELLEGODE_OLLAMA_FORCE_CPU=1
```
*Note: CPU-only inference is inherently slower but remains entirely stable on lower-end systems.*

### Connection Refused to Ollama
**Solution**:
1. Verify Ollama is actively running.
2. Confirm Ollama is accessible by running `curl http://localhost:11434/api/tags`.
3. Check that your `intellegode.ollamaUrl` setting correctly resolves to the active Ollama host.

### Model Not Found Error
**Solution**:
The required model has not been downloaded to the Ollama runtime. Pull the required model:
```bash
ollama pull qwen3.5:4b
```

### Request Timeout Error
**Cause**: The model is sustaining a cold-boot load that exceeds the timeout threshold.
**Solution**:
Wait a few seconds for the model to cache into memory and try again. Alternatively, increase the timeout limit via the `INTELLEGODE_OLLAMA_REQUEST_TIMEOUT_MS` variable.

## Roadmap

- [x] v1 — Active Quizzer (Highlight -> Question -> Feedback)
- [x] v0.1.0 — Concept Debt Tracker (Spaced Repetition & History)
- [ ] v2 — Project Ownership Mapping
- [ ] v3 — Reconstruction Challenges
