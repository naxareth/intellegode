# Intellegode

> Fight vibe coding. Understand your own code.

Intellegode is a VS Code extension that uses a local LLM to quiz you on code you just wrote or AI-generated — making sure you actually understand it before moving on. Fully local, no cloud, no subscriptions.

## How it works

1. Highlight a block of code in your editor
2. Trigger Intellegode (`Ctrl+Shift+P` → "Intellegode: Quiz Me")
3. Answer the comprehension question in the sidebar
4. Find out if you actually get it

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/) installed locally or [Docker](https://www.docker.com/) (for Ollama)
- [VS Code](https://code.visualstudio.com/) v1.74+

## Setup

**1. Clone the repo**
```bash
git clone <repo-url>
cd intellegode
```

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
docker exec intellegode-ollama ollama pull qwen2.5:3b
```

If you run Ollama locally:
```bash
ollama pull qwen2.5:3b
```

**4. Install dependencies**
```bash
npm install
```

**5. Run the extension**

Press `F5` in VS Code to launch the Extension Development Host.

## Tech Stack

- VS Code Extension API (TypeScript)
- Ollama (local LLM runtime via Docker)
- Qwen2.5 3B (code comprehension model)

## Roadmap

- [ ] v1 — Quizzer (highlight → question → answer)
- [ ] v2 — Concept Debt Tracker
- [ ] v3 — Ownership Map
- [ ] v4 — Reconstruction Challenges
