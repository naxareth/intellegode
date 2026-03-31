import { OllamaGenerateResponse } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_MODEL = 'qwen3.5:4b';

export async function callOllama(
	prompt: string,
	model: string = DEFAULT_OLLAMA_MODEL,
	maxTokens: number = 300,
	timeoutMs: number = 45000
): Promise<string> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(OLLAMA_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model,
				prompt,
				options: {
					num_predict: maxTokens,
					temperature: 0.2
				},
				stream: false
			})
		});

		if (!response.ok) {
			let detail = '';
			try {
				detail = await response.text();
			} catch {
				detail = '';
			}
			const suffix = detail ? ` - ${detail.slice(0, 200)}` : '';
			throw new Error(`Ollama returned ${response.status} ${response.statusText}${suffix}`);
		}

		const data = (await response.json()) as OllamaGenerateResponse;
		if (data.error) {
			throw new Error(data.error);
		}

		return data.response?.trim() ?? '';
	} finally {
		clearTimeout(timeout);
	}
}
