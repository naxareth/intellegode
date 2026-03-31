import { OllamaGenerateResponse } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const DEFAULT_OLLAMA_MODEL = 'qwen3.5:4b';
const PREFERRED_FALLBACK_MODELS = ['qwen3.5:4b', 'qwen3:4b', 'qwen2.5:3b'];

type OllamaTagsResponse = {
	models?: Array<{ name?: string }>;
};

function isModelNotFoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return /model\s+['"][^'"]+['"]\s+not found/i.test(error.message);
}

async function fetchAvailableModels(timeoutMs: number): Promise<string[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), Math.max(5000, Math.floor(timeoutMs / 2)));

	try {
		const response = await fetch(OLLAMA_TAGS_URL, { signal: controller.signal });
		if (!response.ok) {
			return [];
		}

		const data = (await response.json()) as OllamaTagsResponse;
		return (data.models ?? [])
			.map((item) => String(item.name ?? '').trim())
			.filter((name) => name.length > 0);
	} catch {
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

function pickFallbackModel(requestedModel: string, availableModels: string[]): string | null {
	for (const candidate of PREFERRED_FALLBACK_MODELS) {
		if (candidate !== requestedModel && availableModels.includes(candidate)) {
			return candidate;
		}
	}

	for (const model of availableModels) {
		if (model !== requestedModel) {
			return model;
		}
	}

	return null;
}

async function generateWithModel(prompt: string, model: string, maxTokens: number, timeoutMs: number): Promise<string> {
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

export async function callOllama(
	prompt: string,
	model: string = DEFAULT_OLLAMA_MODEL,
	maxTokens: number = 300,
	timeoutMs: number = 45000
): Promise<string> {
	try {
		return await generateWithModel(prompt, model, maxTokens, timeoutMs);
	} catch (error) {
		if (!isModelNotFoundError(error)) {
			throw error;
		}

		const availableModels = await fetchAvailableModels(timeoutMs);
		const fallbackModel = pickFallbackModel(model, availableModels);
		if (fallbackModel) {
			console.warn(`Configured model '${model}' is missing. Falling back to '${fallbackModel}'.`);
			return await generateWithModel(prompt, fallbackModel, maxTokens, timeoutMs);
		}

		const available = availableModels.length > 0 ? availableModels.join(', ') : 'none';
		throw new Error(
			`Configured model '${model}' is not installed in Ollama. Available models: ${available}. ` +
			`Install it with: ollama pull ${model}`
		);
	}
}
