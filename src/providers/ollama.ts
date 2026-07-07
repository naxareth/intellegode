import * as vscode from 'vscode';
import { OllamaChatResponse } from '../types';
import { LLMProvider, LLMRequestOptions } from './types';

const PREFERRED_FALLBACK_MODELS = ['qwen3.5:4b', 'qwen3:4b', 'qwen2.5:3b'];
const DEFAULT_NUM_CTX = 3072;
const OLLAMA_REQUEST_TIMEOUT_OVERRIDE_MS = Number.parseInt(process.env.INTELLEGODE_OLLAMA_REQUEST_TIMEOUT_MS ?? '0', 10);
const DEBUG = process.env.INTELLEGODE_DEBUG === '1';
const debugLog = (...args: unknown[]): void => { if (DEBUG) { console.warn(...args); } };

type OllamaTagsResponse = {
	models?: Array<{ name?: string }>;
};

type GenerateOptions = {
	forceCpu?: boolean;
	reduceContext?: boolean;
	numCtx?: number;
};

function getIntellegodeConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('intellegode');
}

function getConfiguredOllamaBaseUrl(): string {
	const configured = getIntellegodeConfig().get<string>('ollamaUrl');
	const normalized = (configured ?? '').trim().replace(/\/+$/, '');
 if (!normalized) {
		throw new Error('Missing configuration: intellegode.ollamaUrl');
	}

	return normalized;
}

function getConfiguredDefaultModel(): string {
	const configured = getIntellegodeConfig().get<string>('defaultModel');
	const normalized = (configured ?? '').trim();
	if (!normalized) {
		throw new Error('Missing configuration: intellegode.defaultModel');
	}

	return normalized;
}

function getOllamaChatUrl(): string {
	return `${getConfiguredOllamaBaseUrl()}/api/chat`;
}

function getOllamaTagsUrl(): string {
	return `${getConfiguredOllamaBaseUrl()}/api/tags`;
}

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
		const response = await fetch(getOllamaTagsUrl(), { signal: controller.signal });
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

function resolveRequestTimeoutMs(fallbackMs?: number): number | null {
	if (Number.isFinite(OLLAMA_REQUEST_TIMEOUT_OVERRIDE_MS) && OLLAMA_REQUEST_TIMEOUT_OVERRIDE_MS > 0) {
		return OLLAMA_REQUEST_TIMEOUT_OVERRIDE_MS;
	}

	return fallbackMs ?? null;
}

async function generateWithModel(
	prompt: string,
	model: string,
	_maxTokens: number,
	_timeoutMs: number,
	generateOptions: GenerateOptions = {}
): Promise<string> {
	const controller = new AbortController();
	const requestTimeoutMs = resolveRequestTimeoutMs(_timeoutMs);
	const timeout = requestTimeoutMs ? setTimeout(() => controller.abort(), requestTimeoutMs) : null;
	const shouldForceCpu = generateOptions.forceCpu || process.env.INTELLEGODE_OLLAMA_FORCE_CPU === '1';
	const numCtx = generateOptions.numCtx ?? (generateOptions.reduceContext ? 1024 : DEFAULT_NUM_CTX);
	const startedAt = Date.now();

	console.warn(
		`[INTELLEGODE][OLLAMA REQUEST][${model}] promptChars=${prompt.length} numCtx=${numCtx} stream=true timeoutMs=${requestTimeoutMs ?? 'none'} forceCpu=${shouldForceCpu}`
	);

	try {
		const response = await fetch(getOllamaChatUrl(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model,
				think: false,
				messages: [{ role: 'system', content: 'You are a fast API. Do not output thinking processes or internal monologues. Provide only the final answer.' }, { role: 'user', content: prompt }],
				options: {
					temperature: 0.2,
					num_ctx: numCtx,
					...(shouldForceCpu ? { num_gpu: 0 } : {})
				},
				stream: true,
				keep_alive: '10m'
			})
		});

		debugLog(`[INTELLEGODE][OLLAMA RESPONSE][${model}] status=${response.status} ok=${response.ok}`);

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

		const rawContent = await readStreamingChatResponse(response, model);
		debugLog(`[INTELLEGODE][OLLAMA RAW][${model}]`, rawContent);
		debugLog(`[INTELLEGODE][OLLAMA DONE][${model}] durationMs=${Date.now() - startedAt} chars=${rawContent.length}`);
		return rawContent.trim();
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Ollama chat request timed out after ${requestTimeoutMs ?? 'unknown'}ms for model '${model}'.`);
		}

		throw error;
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}

async function readStreamingChatResponse(response: Response, model: string): Promise<string> {
	if (!response.body) {
		throw new Error(`Ollama response body is empty for model '${model}'.`);
	}

	const decoder = new TextDecoder();
	const reader = response.body.getReader();
	let buffer = '';
	let combined = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}

			const data = parseStreamingLine(trimmed, model);
			if (data.error) {
				throw new Error(data.error);
			}

			const chunk = data.message?.content ?? '';
			if (chunk) {
				combined += chunk;
			}
		}
	}

	const trailing = buffer.trim();
	if (trailing) {
		const data = parseStreamingLine(trailing, model);
		if (data.error) {
			throw new Error(data.error);
		}

		const chunk = data.message?.content ?? '';
		if (chunk) {
			combined += chunk;
		}
	}

	return combined;
}

function parseStreamingLine(line: string, model: string): OllamaChatResponse {
	try {
		return JSON.parse(line) as OllamaChatResponse;
	} catch {
		throw new Error(`Failed to parse Ollama streaming line for model '${model}': ${line.slice(0, 200)}`);
	}
}

export async function checkOllamaAvailability(): Promise<{ available: boolean; message?: string }> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(getOllamaTagsUrl(), { signal: controller.signal });
		clearTimeout(timeout);

		if (!response.ok) {
			return {
				available: false,
				message: `Ollama is not responding (HTTP ${response.status}). Make sure Ollama is running: 'ollama serve' or 'docker-compose up -d'`
			};
		}

		return { available: true };
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return {
				available: false,
				message: 'Ollama connection timed out. Make sure Ollama is running.'
			};
		}

		return {
			available: false,
			message: `Cannot connect to Ollama at ${getConfiguredOllamaBaseUrl()}. Check your 'intellegode.ollamaUrl' setting.`
		};
	}
}

export async function callOllama(
	prompt: string,
	model?: string,
	maxTokens: number = 300,
	timeoutMs: number = 45000,
	numCtx?: number
): Promise<string> {
	const requestedModel = model?.trim() ? model : getConfiguredDefaultModel();

	try {
		return await generateWithModel(prompt, requestedModel, maxTokens, timeoutMs, numCtx ? { numCtx } : {});
	} catch (error) {
		if (isModelLoadFailure(error)) {
			console.warn(`Model load failed for '${requestedModel}'. Retrying with safer CPU-oriented options.`);
			try {
				return await generateWithModel(prompt, requestedModel, maxTokens, timeoutMs, {
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
		const fallbackModel = pickFallbackModel(requestedModel, availableModels);
		if (fallbackModel) {
			console.warn(`Configured model '${requestedModel}' is missing. Falling back to '${fallbackModel}'.`);
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
			`Configured model '${requestedModel}' is not installed in Ollama. Available models: ${available}. ` +
			`Install it with: ollama pull ${requestedModel}`
		);
	}
}

export const ollamaProvider: LLMProvider = {
	name: 'ollama',
	async sendPrompt(prompt: string, options?: LLMRequestOptions): Promise<string> {
		return callOllama(
			prompt,
			options?.model,
			options?.maxTokens ?? 300,
			options?.timeoutMs ?? 45000,
			options?.numCtx
		);
	},
	checkAvailability: checkOllamaAvailability
};
