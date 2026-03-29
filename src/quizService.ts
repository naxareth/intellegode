import { callOllama } from './ollamaClient';
import {
	buildEvaluatePrompt,
	buildEvaluationRepairPrompt,
	buildHintPrompt,
	buildQuizQuestionPrompt
} from './prompts';

export type OllamaCaller = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;
export type OllamaCallerWithModel = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;

const LABEL_PREFIX = /^(\[PASS\]|\[PARTIAL\]|\[MISS\])\s+/;
const LEGACY_LABEL_PREFIX = /^(✅\s*Got it|⚠️\s*Partially right|❌\s*Not quite)\s*/;

export async function generateQuizQuestion(selectedCode: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const result = await ollamaCaller(buildQuizQuestionPrompt(selectedCode), undefined, 60, 15000);
	return result || 'No question was generated.';
}

export async function generateHint(code: string, question: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const result = await ollamaCaller(buildHintPrompt(code, question), undefined, 55, 15000);
	return result || 'No hint was generated.';
}

export async function evaluateAnswer(
	code: string,
	question: string,
	answer: string,
	model: string = 'qwen3:4b',
	ollamaCaller: OllamaCallerWithModel = callOllama
): Promise<string> {
	const initial = await ollamaCaller(buildEvaluatePrompt(code, question, answer), model, 70, 18000);
	const normalizedInitial = normalizeEvaluationOutput(initial);
	if (normalizedInitial && isContextuallyRelevant(normalizedInitial, question, answer)) {
		return normalizedInitial;
	}

	// Retry once by asking Ollama to rewrite malformed output to the required format.
	const repaired = await ollamaCaller(buildEvaluationRepairPrompt(initial, question, answer), model, 70, 18000);
	const normalizedRepaired = normalizeEvaluationOutput(repaired);
	if (normalizedRepaired && isContextuallyRelevant(normalizedRepaired, question, answer)) {
		return normalizedRepaired;
	}

	return '[PARTIAL] You captured part of the idea because your answer points in the right direction. You missed at least one key component of what the code is doing.';
}

export function normalizeEvaluationOutput(raw: string): string | null {
	const oneLine = raw.replace(/\r?\n+/g, ' ').trim();
	if (!oneLine) {
		return null;
	}

	const mapped = oneLine
		.replace(/^(✅\s*Got it!?)/, '[PASS]')
		.replace(/^(⚠️\s*Partially right\.?)/, '[PARTIAL]')
		.replace(/^(❌\s*Not quite\.?)/, '[MISS]')
		.replace(/^\[(pass|partial|miss)\]/i, (match) => match.toUpperCase());

	if (!LABEL_PREFIX.test(mapped) && !LEGACY_LABEL_PREFIX.test(mapped)) {
		return null;
	}

	if (!isValidEvaluationOutput(mapped)) {
		return null;
	}

	return mapped;
}

export function isValidEvaluationOutput(text: string): boolean {
	const normalized = text.trim();
	if (!LABEL_PREFIX.test(normalized)) {
		return false;
	}

	const payload = normalized.replace(LABEL_PREFIX, '').trim();
	if (!payload) {
		return false;
	}

	// Enforce that feedback has at least a short explanation, not just one word.
	if (payload.split(/\s+/).length < 3) {
		return false;
	}

	return true;
}

export function isContextuallyRelevant(feedback: string, question: string, answer: string): boolean {
	const feedbackTerms = extractKeyTerms(feedback);
	const contextTerms = new Set([...extractKeyTerms(question), ...extractKeyTerms(answer)]);

	if (feedbackTerms.size === 0 || contextTerms.size === 0) {
		return true;
	}

	let overlap = 0;
	for (const term of feedbackTerms) {
		if (contextTerms.has(term)) {
			overlap += 1;
		}
	}

	return overlap >= 1;
}

function extractKeyTerms(text: string): Set<string> {
	const stopWords = new Set([
		'the', 'this', 'that', 'with', 'from', 'your', 'you', 'about', 'into', 'what', 'when', 'where', 'which',
		'because', 'would', 'could', 'should', 'their', 'there', 'these', 'those', 'have', 'has', 'were', 'been',
		'for', 'and', 'are', 'not', 'but', 'all', 'any', 'one', 'two', 'step', 'code', 'idea', 'part', 'main'
	]);

	const tokens = text
		.toLowerCase()
		.replace(/\[[^\]]+\]/g, ' ')
		.replace(/[^a-z0-9_\s]/g, ' ')
		.split(/\s+/)
		.filter((token) => token.length >= 4 && !stopWords.has(token));

	return new Set(tokens);
}
