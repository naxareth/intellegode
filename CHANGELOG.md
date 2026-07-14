# Change Log

## [0.2.1] - 2026-07-12

### Added
- Difficulty selector (Easy / Medium / Hard) in the quiz panel to control question depth

## [0.2.0] - 2026-07-08

### Added
- **Multi-Provider LLM Support** — Intellegode now supports any OpenAI-compatible API endpoint (OpenAI, Groq, Together, LM Studio, etc.) in addition to local Ollama.
- **Secure API Key Storage** — Added the `Intellegode: Set API Key` command to securely store cloud API keys in the OS keychain.
- **Configuration Updates** — Added `intellegode.provider` and `intellegode.apiBaseUrl` settings to easily switch between local and cloud inference.

## [0.1.0] - 2026-07-04

### Added
- **Persistent Storage** — Quiz history is now saved across sessions and workspaces
- **Concept Debt Tracking** — Automatically tags questions with concept categories (e.g., async/await, loops)
- **Progress Dashboard** — Press `Ctrl+Alt+D` or run "View Progress" to see a heatmap of your weakest concepts
- **Spaced Repetition Nudges** — Get a smart tip to review forgotten concepts when you open the quiz
- **Streak Tracking** — Daily study streaks are tracked and displayed in the quiz header

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