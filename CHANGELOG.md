# Change Log

## [0.0.1] - 2026-04-18

### Added
- **Quiz Me command** (`Ctrl+Alt+Q` / `Cmd+Alt+Q`) — highlight any code block and get an AI-generated comprehension question about it
- **LLM-powered questions** — uses a locally running Ollama model (default: `qwen3.5:4b`) to generate WHY/HOW questions anchored to the specific code you selected
- **Answer evaluation** — submit your answer and get a plain-English explanation from the model clarifying what the code actually does
- **Hint system** — click "Give me a hint" for a conceptual nudge without giving away the answer
- **Session history** — tracks recent questions per code selection to avoid repeating the same question
- **Self-grading** — mark answers as "Got it" or "Missed it" with a visual session progress bar
- **Dynamic loading UI** — cycling loading messages while the model is thinking
- **Configurable Ollama URL and model** via VS Code settings (`intellegode.ollamaUrl`, `intellegode.defaultModel`)
- **Automatic model fallback** — if the configured model isn't found, the extension tries other available models
- **Snippet length warning** — notifies you when a selection is too large for best results