import { OllamaGenerateResponse } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

export async function callOllama(prompt: string, model: string = DEFAULT_OLLAMA_MODEL): Promise<string> {
	const response = await fetch(OLLAMA_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			prompt,
			stream: false
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama returned ${response.status} ${response.statusText}`);
	}

	const data = (await response.json()) as OllamaGenerateResponse;
	if (data.error) {
		throw new Error(data.error);
	}

	return data.response?.trim() ?? '';
}
