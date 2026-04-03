import { OllamaChatResponse } from './types';

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const DEFAULT_OLLAMA_MODEL = 'qwen3.5:4b';
const PREFERRED_FALLBACK_MODELS = ['qwen3.5:4b', 'qwen3:4b', 'qwen2.5:3b'];
const DEFAULT_NUM_CTX = 4096;

type OllamaTagsResponse = {
	models?: Array<{ name?: string }>;
};

type GenerateOptions = {
	forceCpu?: boolean;
	reduceContext?: boolean;
	numCtx?: number;
};

function isModelNotFoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return /model\s+['"][^'"]+['"]\s+not found/i.test(error.message);
}

function isModelLoadFailure(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return /model failed to load|llama runner terminated|connection refused|\bEOF\b/i.test(error.message);
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

async function generateWithModel(
	prompt: string,
	model: string,
	maxTokens: number,
	timeoutMs: number,
	generateOptions: GenerateOptions = {}
): Promise<string> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const shouldForceCpu = generateOptions.forceCpu || process.env.INTELLEGODE_OLLAMA_FORCE_CPU === '1';
	const numCtx = generateOptions.numCtx ?? (generateOptions.reduceContext ? 1024 : DEFAULT_NUM_CTX);

	try {
		const response = await fetch(OLLAMA_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				options: {
					num_predict: maxTokens,
					temperature: 0.2,
					num_ctx: numCtx,
					...(shouldForceCpu ? { num_gpu: 0 } : {})
				},
				stream: false,
				keep_alive: '10m'
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

		const data = (await response.json()) as OllamaChatResponse;
		if (data.error) {
			throw new Error(data.error);
		}

		return data.message?.content?.trim() ?? '';
	} finally {
		clearTimeout(timeout);
	}
}

export async function callOllama(
	prompt: string,
	model: string = DEFAULT_OLLAMA_MODEL,
	maxTokens: number = 300,
	timeoutMs: number = 45000,
	numCtx?: number
): Promise<string> {
	try {
		return await generateWithModel(prompt, model, maxTokens, timeoutMs, numCtx ? { numCtx } : {});
	} catch (error) {
		if (isModelLoadFailure(error)) {
			console.warn(`Model load failed for '${model}'. Retrying with safer CPU-oriented options.`);
			try {
				return await generateWithModel(prompt, model, maxTokens, timeoutMs, {
					forceCpu: true,
					reduceContext: true
				});
			} catch (retryError) {
				if (!isModelNotFoundError(retryError)) {
					throw retryError;
				}
			}
		}

		if (!isModelNotFoundError(error)) {
			throw error;
		}

		const availableModels = await fetchAvailableModels(timeoutMs);
		const fallbackModel = pickFallbackModel(model, availableModels);
		if (fallbackModel) {
			console.warn(`Configured model '${model}' is missing. Falling back to '${fallbackModel}'.`);
			try {
				return await generateWithModel(prompt, fallbackModel, maxTokens, timeoutMs);
			} catch (fallbackError) {
				if (!isModelLoadFailure(fallbackError)) {
					throw fallbackError;
				}

				console.warn(`Fallback model '${fallbackModel}' failed to load. Retrying with safer CPU-oriented options.`);
				return await generateWithModel(prompt, fallbackModel, maxTokens, timeoutMs, {
					forceCpu: true,
					reduceContext: true
				});
			}
		}

		const available = availableModels.length > 0 ? availableModels.join(', ') : 'none';
		throw new Error(
			`Configured model '${model}' is not installed in Ollama. Available models: ${available}. ` +
			`Install it with: ollama pull ${model}`
		);
	}
}
