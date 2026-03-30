import { callOllama } from './ollamaClient';
import {
	buildEvaluatePrompt,
	buildEvaluationRepairPrompt,
	buildHintPrompt,
	buildQuizQuestionPrompt
} from './prompts';

export type OllamaCaller = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;
export type OllamaCallerWithModel = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;

const QUIZ_QUESTION_TIMEOUT_MS = 60000;
const HINT_FIRST_ATTEMPT_TIMEOUT_MS = 18000;
const HINT_SECOND_ATTEMPT_TIMEOUT_MS = 22000;

export async function generateQuizQuestion(selectedCode: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	// First request can include model cold-start, so keep this timeout more forgiving.
	const result = await ollamaCaller(buildQuizQuestionPrompt(selectedCode), undefined, 60, QUIZ_QUESTION_TIMEOUT_MS);
	return result || 'No question was generated.';
}

export async function generateHint(code: string, question: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const first = await ollamaCaller(buildHintPrompt(code, question), undefined, 120, HINT_FIRST_ATTEMPT_TIMEOUT_MS);
	if (first && looksComplete(first)) {
		return first;
	}

	const second = await ollamaCaller(buildHintPrompt(code, question), undefined, 180, HINT_SECOND_ATTEMPT_TIMEOUT_MS);
	return second || first || 'No hint was generated.';
}

export async function evaluateAnswer(
	code: string,
	question: string,
	answer: string,
	model: string = 'qwen3:4b',
	ollamaCaller: OllamaCallerWithModel = callOllama
): Promise<string> {
	const initial = await ollamaCaller(buildEvaluatePrompt(code, question, answer), model, 300, 45000);
	const normalizedInitial = normalizeExplanationOutput(initial);
	if (normalizedInitial && isContextuallyRelevant(normalizedInitial, question, answer)) {
		return normalizedInitial;
	}

	// Retry once by asking Ollama to rewrite malformed output to a concise explanation.
	const repaired = await ollamaCaller(buildEvaluationRepairPrompt(initial, question, answer), model, 300, 50000);
	const normalizedRepaired = normalizeExplanationOutput(repaired);
	if (normalizedRepaired && isContextuallyRelevant(normalizedRepaired, question, answer)) {
		return normalizedRepaired;
	}

	// Prefer a complete model explanation over a generic template when relevance checks are inconclusive.
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	if (normalizedInitial) {
		return normalizedInitial;
	}

	return buildGroundedFallbackExplanation(question, answer);
}

export function normalizeExplanationOutput(raw: string): string | null {
	const oneLine = raw.replace(/\r?\n+/g, ' ').trim();
	if (!oneLine) {
		return null;
	}

	const sanitized = stripLeadingGradeLabels(oneLine);
	if (!sanitized) {
		return null;
	}

	if (!isValidExplanationOutput(sanitized)) {
		return null;
	}

	return sanitized;
}

export function isValidExplanationOutput(text: string): boolean {
	const normalized = text.trim();
	if (!normalized) {
		return false;
	}

	if (/\[(PASS|PARTIAL|MISS)\]/i.test(normalized)) {
		return false;
	}

	if (normalized.split(/\s+/).length < 10) {
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
		.map(normalizeToken)
		.filter((token) => token.length >= 4 && !stopWords.has(token));

	return new Set(tokens);
}

function looksComplete(text: string): boolean {
	const trimmed = text.trim();
	return /[.!?]$/.test(trimmed);
}

function stripLeadingGradeLabels(text: string): string {
	return text
		.replace(/^\s*\[(PASS|PARTIAL|MISS)\]\s*/i, '')
		.replace(/^\s*(PASS|PARTIAL|MISS)\s*[:\-]\s*/i, '')
		.trim();
}

function normalizeToken(token: string): string {
	if (token.length > 5 && token.endsWith('ing')) {
		return token.slice(0, -3);
	}

	if (token.length > 4 && token.endsWith('ed')) {
		return token.slice(0, -2);
	}

	if (token.length > 4 && token.endsWith('es')) {
		return token.slice(0, -2);
	}

	if (token.length > 4 && token.endsWith('s')) {
		return token.slice(0, -1);
	}

	return token;
}

function buildGroundedFallbackExplanation(question: string, answer: string): string {
	const compactQuestion = question.replace(/\s+/g, ' ').trim();
	const compactAnswer = answer.replace(/\s+/g, ' ').trim();
	const hasSubstantialAnswer = compactAnswer.split(/\s+/).length >= 6;

	if (hasSubstantialAnswer) {
		return `Your answer is close to the core idea: ${compactAnswer}. To complete it, tie it directly to "${compactQuestion}" and explain what behavior this guarantees in the selected code path.`;
	}

	return `Focus on "${compactQuestion}" by describing the exact behavior in the selected code and why that behavior matters for correctness.`;
}
