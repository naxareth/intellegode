/**
 * Converts technical errors into user-friendly messages with actionable guidance
 */

export function getUserFriendlyErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return 'Something went wrong. Please try again.';
	}

	const message = error.message.toLowerCase();

	// Ollama connection issues
	if (message.includes('ollama') || message.includes('connection refused') || message.includes('econnrefused')) {
		return 'Cannot connect to Ollama. Make sure it\'s running: "ollama serve" or "docker-compose up -d"';
	}

	// Model not found
	if (message.includes('model') && message.includes('not found')) {
		return 'The model "qwen3.5:4b" is not installed. Install it with: "ollama pull qwen3.5:4b"';
	}

	// Model load failure (GPU/memory issues)
	if (message.includes('failed to load') || message.includes('out of memory') || message.includes('oom')) {
		return 'The model failed to load (possibly out of memory). Try restarting Ollama or enabling CPU-only mode.';
	}

	// Timeout issues
	if (message.includes('timeout') || message.includes('timed out')) {
		return 'Request timed out. This might happen if the model is loading for the first time or your system is busy. Try again.';
	}

	// Stream parsing issues
	if (message.includes('parsing') || message.includes('streaming')) {
		return 'Failed to parse response from Ollama. This might be a temporary issue. Try again.';
	}

	// Configuration issues
	if (message.includes('configuration') || message.includes('intellegode')) {
		return 'Configuration error. Check your Intellegode settings: "intellegode.ollamaUrl" and "intellegode.defaultModel"';
	}

	// Fallback: return original error if it's not too technical
	if (error.message.length > 150) {
		return 'An unexpected error occurred. Check the Intellegode output panel for details.';
	}

	return error.message;
}

export function getHintForError(error: unknown): string {
	if (!(error instanceof Error)) {
		return '';
	}

	const message = error.message.toLowerCase();

	if (message.includes('timeout')) {
		return 'Tip: First-time model loads take longer. Be patient on subsequent requests.';
	}

	if (message.includes('model') && message.includes('not found')) {
		return 'Tip: Make sure you ran "ollama pull qwen3.5:4b" to download the model.';
	}

	if (message.includes('connection')) {
		return 'Tip: Check that Ollama is running and accessible at your configured URL.';
	}

	return '';
}
