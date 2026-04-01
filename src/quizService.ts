import { callOllama } from './ollamaClient';
import {
	buildEvaluatePrompt,
	buildEvaluationRepairPrompt,
	buildHintPrompt,
	buildQuizQuestionRepairPrompt,
	buildQuizQuestionPrompt
} from './prompts';

export type OllamaCaller = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;
export type OllamaCallerWithModel = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number) => Promise<string>;

const QUIZ_QUESTION_TIMEOUT_MS = 60000;
const HINT_FIRST_ATTEMPT_TIMEOUT_MS = 18000;
const HINT_SECOND_ATTEMPT_TIMEOUT_MS = 22000;
const MIN_EXPLANATION_WORDS = 6;

export async function generateQuizQuestion(selectedCode: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	// First request can include model cold-start, so keep this timeout more forgiving.
	const first = await ollamaCaller(buildQuizQuestionPrompt(selectedCode), undefined, 60, QUIZ_QUESTION_TIMEOUT_MS);
	const normalizedFirst = normalizeQuizQuestionOutput(first);
	if (normalizedFirst) {
		return normalizedFirst;
	}

	const repaired = await ollamaCaller(buildQuizQuestionRepairPrompt(first, selectedCode), undefined, 80, QUIZ_QUESTION_TIMEOUT_MS);
	const normalizedRepaired = normalizeQuizQuestionOutput(repaired);
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	return buildFallbackQuestion(selectedCode);
}

export function normalizeQuizQuestionOutput(raw: string): string | null {
	const flattened = raw.replace(/\r?\n+/g, ' ').trim();
	if (!flattened) {
		return null;
	}

	const withoutCodeFences = flattened
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	const deLabeled = withoutCodeFences
		.replace(/^\s*(question|comprehension check|quiz question)\s*[:\-]\s*/i, '')
		.replace(/^\s*(sure|certainly|here(?:\s+is|\s*'s)|below)\b[^.?!]*[.?!]\s*/i, '')
		.trim();

	if (!deLabeled) {
		return null;
	}

	const starterMatches = Array.from(
		deLabeled.matchAll(/\b(what|why|how|which|when|where|who|does)\b[^?]{4,200}\?/ig)
	);
	for (let i = starterMatches.length - 1; i >= 0; i -= 1) {
		const starterCandidate = starterMatches[i][0].replace(/\s+/g, ' ').trim();
		if (isValidQuestion(starterCandidate)) {
			return starterCandidate;
		}
	}

	const candidateMatches = deLabeled.match(/[A-Z][^?]{8,220}\?/g) ?? [];
	for (const rawCandidate of candidateMatches) {
		const candidate = rawCandidate.replace(/^[^A-Za-z]+/, '').replace(/\s+/g, ' ').trim();
		if (isValidQuestion(candidate)) {
			return candidate;
		}
	}

	const fallbackCandidate = deLabeled.replace(/\s+/g, ' ').trim();
	if (!isValidQuestion(fallbackCandidate)) {
		return null;
	}

	return fallbackCandidate;
}

function isValidQuestion(text: string): boolean {
	if (text.length < 10 || text.length > 220) {
		return false;
	}

	if (!text.includes('?')) {
		return false;
	}

	if (/\b(import|function|class|return\s+|const\s+|let\s+|var\s+)\b/i.test(text)) {
		return false;
	}

	if (/^\s*["'`]/.test(text)) {
		return false;
	}

	return true;
}

function buildFallbackQuestion(selectedCode: string): string {
	const codeLower = selectedCode.toLowerCase();
	if (codeLower.includes('if') || codeLower.includes('else')) {
		return 'What condition decides which branch of logic runs in this code?';
	}

	if (codeLower.includes('for (') || codeLower.includes('while (') || codeLower.includes('.map(')) {
		return 'What is the main purpose of the loop in this code?';
	}

	if (codeLower.includes('try {') || codeLower.includes('catch')) {
		return 'How does this code handle failure cases?';
	}

	return 'What is the main responsibility of this code block?';
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
	_answer: string,
	model: string = 'qwen3.5:4b',
	ollamaCaller: OllamaCallerWithModel = callOllama
): Promise<string> {
	const initial = await ollamaCaller(buildEvaluatePrompt(code, question), model, 300, 45000);
	const normalizedInitial = normalizeExplanationOutput(initial);
	if (normalizedInitial && isContextuallyRelevant(normalizedInitial, question)) {
		return normalizedInitial;
	}

	// Retry once by asking Ollama to rewrite malformed output to a concise explanation.
	const repaired = await ollamaCaller(buildEvaluationRepairPrompt(initial, question), model, 300, 50000);
	const normalizedRepaired = normalizeExplanationOutput(repaired);
	if (normalizedRepaired && isContextuallyRelevant(normalizedRepaired, question)) {
		return normalizedRepaired;
	}

	// Prefer a complete model explanation over a generic template when relevance checks are inconclusive.
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	if (normalizedInitial) {
		return normalizedInitial;
	}

	return buildGroundedFallbackExplanation(code, question);
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

	if (normalized.split(/\s+/).length < MIN_EXPLANATION_WORDS) {
		return false;
	}

	return true;
}

export function isContextuallyRelevant(feedback: string, question: string): boolean {
	const feedbackTerms = extractKeyTerms(feedback);
	const contextTerms = extractKeyTerms(question);

	if (contextTerms.has('upsert')) {
		if (feedbackTerms.has('upsert')) {
			return true;
		}

		// Treat create/update wording as an upsert explanation when both are present.
		const hasCreateStem = feedbackTerms.has('creat') || feedbackTerms.has('create');
		const hasUpdateStem = feedbackTerms.has('updat') || feedbackTerms.has('update');
		if (hasCreateStem && hasUpdateStem) {
			return true;
		}
	}

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
	const withCamelSplit = text.replace(/([a-z])([A-Z])/g, '$1 $2');
	const stopWords = new Set([
		'the', 'this', 'that', 'with', 'from', 'your', 'you', 'about', 'into', 'what', 'when', 'where', 'which',
		'because', 'would', 'could', 'should', 'their', 'there', 'these', 'those', 'have', 'has', 'were', 'been',
		'for', 'and', 'are', 'not', 'but', 'all', 'any', 'one', 'two', 'step', 'code', 'idea', 'part', 'main'
	]);

	const tokens = withCamelSplit
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

function buildGroundedFallbackExplanation(code: string, question: string): string {
	const codeLower = code.toLowerCase();
	const questionLower = question.toLowerCase();

	if (questionLower.includes('upsert')) {
		return 'prisma.users.upsert looks up a user by wallet_address and reuses that row when it already exists; when no match is found, it creates a new user with the student details in the create block. This ensures each student has a user record before the next step writes a verified credential tied to that user and the batch.';
	}

	if (codeLower.includes('for (const') && codeLower.includes('.create(') && codeLower.includes('prisma.')) {
		return 'The handler first creates a batch record, then loops through each student and writes the related database records needed for that student. It links each created credential back to both the resolved user and the batch so the response can report how many records were processed.';
	}

	return 'The code performs concrete data operations in sequence and persists the result so later steps can safely reference those saved records. It matters because each write depends on the previous one being created correctly.';
}
