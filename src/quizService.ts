import { callOllama } from './ollamaClient';
import {
	buildEvaluatePrompt,
	buildEvaluationRepairPrompt,
	buildHintPrompt,
	buildQuizQuestionPrompt
} from './prompts';

export type OllamaCaller = (prompt: string) => Promise<string>;

const LABEL_PREFIX = /^(\[PASS\]|\[PARTIAL\]|\[MISS\])\s+/;
const LEGACY_LABEL_PREFIX = /^(✅\s*Got it|⚠️\s*Partially right|❌\s*Not quite)\s*/;

export async function generateQuizQuestion(selectedCode: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const result = await ollamaCaller(buildQuizQuestionPrompt(selectedCode));
	return result || 'No question was generated.';
}

export async function generateHint(code: string, question: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const result = await ollamaCaller(buildHintPrompt(code, question));
	return result || 'No hint was generated.';
}

export async function evaluateAnswer(
	code: string,
	question: string,
	answer: string,
	ollamaCaller: OllamaCaller = callOllama
): Promise<string> {
	const initial = await ollamaCaller(buildEvaluatePrompt(code, question, answer));
	const normalizedInitial = normalizeEvaluationOutput(initial);
	if (normalizedInitial) {
		return normalizedInitial;
	}

	// Retry once by asking Ollama to rewrite malformed output to the required format.
	const repaired = await ollamaCaller(buildEvaluationRepairPrompt(initial));
	const normalizedRepaired = normalizeEvaluationOutput(repaired);
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	return '[PARTIAL] You showed some understanding because you engaged with the core idea, but refine your explanation and try again.';
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
