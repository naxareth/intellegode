import { callOllama } from './ollamaClient';
import {
	buildEvaluatePrompt,
	buildEvaluationRepairPrompt,
	buildHintPrompt,
	buildQuizQuestionRepairPrompt,
	buildQuizQuestionPrompt
} from './prompts';

export type OllamaCaller = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number, numCtx?: number) => Promise<string>;
export type OllamaCallerWithModel = (prompt: string, model?: string, maxTokens?: number, timeoutMs?: number, numCtx?: number) => Promise<string>;

const QUIZ_QUESTION_TIMEOUT_MS = 90000;
const HINT_FIRST_ATTEMPT_TIMEOUT_MS = 45000;
const HINT_SECOND_ATTEMPT_TIMEOUT_MS = 60000;
const QUIZ_MODEL = 'qwen3.5:4b';
const MAX_QUESTION_ATTEMPTS = 2;
const QUESTION_HISTORY_WINDOW = 8;
const MAX_SELECTED_SNIPPET_CHARS = 4000;
const MAX_FILE_CONTEXT_CHARS = 5000;
const QUESTION_HINT_NUM_CTX = 2048;

type QuestionFocusMode = 'behavior' | 'mechanism' | 'failure' | 'tradeoff';


export async function generateQuizQuestion(
	selectedCode: string,
	fileCodeContext: string,
	ollamaCaller: OllamaCaller = callOllama,
	recentQuestions: string[] = []
): Promise<string> {
	const selectedSnippetContext = prepareContext(selectedCode, MAX_SELECTED_SNIPPET_CHARS);
	const fileContext = prepareContext(fileCodeContext || selectedCode, MAX_FILE_CONTEXT_CHARS);
	const seenQuestions = recentQuestions.slice(-QUESTION_HISTORY_WINDOW);
	const focusMode = chooseQuestionFocusMode(seenQuestions);
	let lastFirst = '';
	let lastRepaired = '';

	for (let attempt = 0; attempt < MAX_QUESTION_ATTEMPTS; attempt += 1) {
		// First request can include model cold-start, so keep this timeout more forgiving.
		const first = await ollamaCaller(
			buildQuizQuestionPrompt(selectedSnippetContext, fileContext, seenQuestions),
			QUIZ_MODEL,
			60,
			QUIZ_QUESTION_TIMEOUT_MS,
			QUESTION_HINT_NUM_CTX
		);
		lastFirst = first;
		const normalizedFirst = normalizeQuizQuestionOutput(first);
		if (
			normalizedFirst &&
			!isRepeatedQuestion(normalizedFirst, seenQuestions) &&
			isQuestionGroundedInSnippet(normalizedFirst, selectedSnippetContext)
		) {
			return normalizedFirst;
		}

		if (normalizedFirst) {
			seenQuestions.push(normalizedFirst);
		}

		const repaired = await ollamaCaller(
			buildQuizQuestionRepairPrompt(first, selectedSnippetContext, fileContext, seenQuestions),
			QUIZ_MODEL,
			80,
			QUIZ_QUESTION_TIMEOUT_MS,
			QUESTION_HINT_NUM_CTX
		);
		lastRepaired = repaired;
		const normalizedRepaired = normalizeQuizQuestionOutput(repaired);
		if (
			normalizedRepaired &&
			!isRepeatedQuestion(normalizedRepaired, seenQuestions) &&
			isQuestionGroundedInSnippet(normalizedRepaired, selectedSnippetContext)
		) {
			return normalizedRepaired;
		}

		if (normalizedRepaired) {
			seenQuestions.push(normalizedRepaired);
		}
	}

	console.warn('Raw LLM Attempt:', lastFirst, lastRepaired);
	return buildFallbackQuestion(selectedSnippetContext, seenQuestions, focusMode);
}

export function normalizeQuizQuestionOutput(raw: string): string | null {
	const flattened = raw.replace(/```[\s\S]*?```/g, ' ').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
	if (!flattened) {
		return null;
	}

	const questionSegments = flattened.match(/[^.!?;:]*\?/g) ?? [];
	for (const segment of questionSegments) {
		const candidate = segment.trim();
		if (candidate) {
			return candidate;
		}
	}

	if (flattened.includes('?')) {
		return flattened.slice(0, flattened.indexOf('?') + 1).trim();
	}

	return null;
}

function buildFallbackQuestion(selectedCode: string, recentQuestions: string[], focusMode: QuestionFocusMode): string {
	const signals = collectCodeSignals(selectedCode);
	const candidates: string[] = [];

	if (focusMode === 'behavior') {
		if (signals.hasCondition && signals.hasReturn) {
			candidates.push('How does the decision check in this snippet change what value gets returned to the caller?');
		}

		if (signals.hasTransformation) {
			candidates.push('How does this snippet transform data before producing its final output?');
		}

		if (signals.hasAsync) {
			candidates.push('Why does this snippet wait for an asynchronous step before continuing the flow?');
		}

		if (signals.hasTryCatch) {
			candidates.push('How does this snippet keep execution stable when its main operation fails?');
		}
	}

	if (focusMode === 'mechanism') {
		candidates.push('What are the key steps this snippet follows from input handling to final output?');

		if (signals.hasLoop || signals.hasTransformation) {
			candidates.push('How does each processing step in this snippet contribute to the final returned result?');
		}
	}

	if (focusMode === 'failure') {
		if (signals.hasTryCatch || signals.hasFallbackDefault) {
			candidates.push('What failure path is handled here, and what fallback behavior keeps the caller flow safe?');
		} else {
			candidates.push('Which assumption in this snippet would cause incorrect behavior if it becomes false at runtime?');
		}
	}

	if (focusMode === 'tradeoff') {
		if (signals.hasFallbackDefault) {
			candidates.push('What trade-off does this fallback strategy make between reliability and visibility of failures?');
		}

		if (signals.hasCondition) {
			candidates.push('What trade-off does this branching decision make between strict checks and flexible behavior?');
		}

		candidates.push('What design consequence would change most if this snippet used a simpler but less defensive approach?');
	}

	candidates.push(
		'What is the most important operation in this highlighted snippet, and why is it necessary for the final outcome?',
		'If this snippet were removed, what concrete behavior would break in the surrounding flow?',
		'How do the core steps in this snippet work together to produce a reliable result?'
	);

	return pickNonRepeatedQuestion(candidates, recentQuestions, selectedCode);
}

function chooseQuestionFocusMode(recentQuestions: string[]): QuestionFocusMode {
	const modes: QuestionFocusMode[] = ['behavior', 'mechanism', 'failure', 'tradeoff'];
	return modes[recentQuestions.length % modes.length]!;
}

function isRepeatedQuestion(candidate: string, recentQuestions: string[]): boolean {
	const normalizedCandidate = normalizeQuestionForComparison(candidate);
	if (!normalizedCandidate) {
		return false;
	}

	for (const question of recentQuestions) {
		if (normalizeQuestionForComparison(question) === normalizedCandidate) {
			return true;
		}
	}

	return false;
}

function normalizeQuestionForComparison(question: string): string {
	return question
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function pickNonRepeatedQuestion(candidates: string[], recentQuestions: string[], selectionSeed: string): string {
	const startIndex = hashString(selectionSeed) % candidates.length;
	for (let offset = 0; offset < candidates.length; offset += 1) {
		const candidate = candidates[(startIndex + offset) % candidates.length]!;
		if (!isRepeatedQuestion(candidate, recentQuestions)) {
			return candidate;
		}
	}

	return candidates[0]!;
}

function prepareContext(source: string, maxChars: number): string {
	const trimmed = source.trim();
	if (trimmed.length <= maxChars) {
		return trimmed;
	}

	const half = Math.floor((maxChars - 9) / 2);
	const head = trimmed.slice(0, half).trimEnd();
	const tail = trimmed.slice(-half).trimStart();
	return `${head}\n\n...\n\n${tail}`;
}

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}

	return hash;
}

type CodeSignals = {
	hasCondition: boolean;
	hasLoop: boolean;
	hasTransformation: boolean;
	hasAsync: boolean;
	hasTryCatch: boolean;
	hasReturn: boolean;
	hasFallbackDefault: boolean;
};

function collectCodeSignals(code: string): CodeSignals {
	return {
		hasCondition: /\bif\s*\(|\belse\b|\bswitch\s*\(/i.test(code),
		hasLoop: /\bfor\s*\(|\bwhile\s*\(|\bfor\s+const\b|\bfor\s+let\b/i.test(code),
		hasTransformation: /\.(map|filter|reduce|flatMap|some|every)\s*\(/i.test(code),
		hasAsync: /\basync\b|\bawait\b|\.then\s*\(/i.test(code),
		hasTryCatch: /\btry\s*\{|\bcatch\s*\(/i.test(code),
		hasReturn: /\breturn\b/i.test(code),
		hasFallbackDefault: /\|\||\?\?|catch\s*\([^)]*\)[\s\S]{0,260}?return\b/i.test(code)
	};
}

export async function generateHint(code: string, question: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const first = await ollamaCaller(buildHintPrompt(code, question), QUIZ_MODEL, 120, HINT_FIRST_ATTEMPT_TIMEOUT_MS, QUESTION_HINT_NUM_CTX);
	const normalizedFirst = normalizeHintOutput(first);
	if (normalizedFirst) {
		return normalizedFirst;
	}

	const repaired = await ollamaCaller(
		buildHintRepairPrompt(first, question),
		QUIZ_MODEL,
		120,
		HINT_SECOND_ATTEMPT_TIMEOUT_MS,
		QUESTION_HINT_NUM_CTX
	);
	const normalizedRepaired = normalizeHintOutput(repaired);
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	console.warn('Raw LLM Attempt:', first, repaired);
	return buildFallbackHint(code, question);
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
	if (normalizedInitial && isContextuallyRelevant(normalizedInitial, question, code)) {
		return normalizedInitial;
	}

	// Retry once by asking Ollama to rewrite malformed output to a concise explanation.
	const repaired = await ollamaCaller(buildEvaluationRepairPrompt(initial, question), model, 300, 50000);
	const normalizedRepaired = normalizeExplanationOutput(repaired);
	if (normalizedRepaired && isContextuallyRelevant(normalizedRepaired, question, code)) {
		return normalizedRepaired;
	}

	// Prefer a complete model explanation over a generic template when relevance checks are inconclusive.
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	if (normalizedInitial) {
		return normalizedInitial;
	}

	console.warn('Raw LLM Attempt:', initial, repaired);
	return buildGroundedFallbackExplanation(code, question);
}

export function normalizeExplanationOutput(raw: string): string | null {
	const oneLine = raw.replace(/\r?\n+/g, ' ').trim();
	if (!oneLine) {
		return null;
	}

	const sanitized = limitToSentences(stripLeadingGradeLabels(oneLine), 3);
	if (!sanitized) {
		return null;
	}

	if (!isValidExplanationOutput(sanitized)) {
		return null;
	}

	return sanitized;
}

export function normalizeHintOutput(raw: string): string | null {
	const flattened = raw
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/\r?\n+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!flattened) {
		return null;
	}

	const sentenceMatch = flattened.match(/[^.!?]+[.!?]/);
	if (sentenceMatch && sentenceMatch[0]) {
		return sentenceMatch[0].trim();
	}

	return flattened;
}

export function isValidExplanationOutput(text: string): boolean {
	return text.trim().length > 10;
}

export function isContextuallyRelevant(feedback: string, _question: string, _codeContext: string = ''): boolean {
	return feedback.trim().length > 10;
}

function isQuestionGroundedInSnippet(question: string, _selectedCode: string): boolean {
	return !isLikelyGenericQuestion(question);
}

function isLikelyGenericQuestion(question: string): boolean {
	const lowered = question.toLowerCase().trim();
	const genericPatterns = [
		/^what is the purpose of/i,
		/^what does this code do/i,
		/^what does this block do/i,
		/^how does this code work/i,
		/^what core purpose/i,
		/^how does the recovery behavior differ/i,
		/^why is it important to catch errors/i,
		/^what condition decides which branch/i
	];

	for (const pattern of genericPatterns) {
		if (pattern.test(lowered)) {
			return true;
		}
	}

	return false;
}

function limitToSentences(text: string, maxSentences: number): string {
	const matches = text.match(/[^.!?]+[.!?]/g);
	if (!matches || matches.length === 0) {
		return text.trim();
	}

	return matches
		.slice(0, maxSentences)
		.map((s) => s.trim())
		.join(' ')
		.trim();
}

function stripLeadingGradeLabels(text: string): string {
	return text
		.replace(/^\s*\[(PASS|PARTIAL|MISS)\]\s*/i, '')
		.replace(/^\s*(PASS|PARTIAL|MISS)\s*[:\-]\s*/i, '')
		.trim();
}

function buildGroundedFallbackExplanation(code: string, question: string): string {
	const signals = collectCodeSignals(code);
	const questionLower = question.toLowerCase();

	if ((questionLower.includes('error') || questionLower.includes('failure') || questionLower.includes('catch')) && (signals.hasTryCatch || signals.hasFallbackDefault)) {
		return 'The snippet protects a risky operation with a failure path so runtime errors do not break the caller flow. When that failure path is triggered, it returns a stable fallback value so downstream logic can continue safely.';
	}

	if ((questionLower.includes('condition') || questionLower.includes('branch') || questionLower.includes('decision')) && signals.hasCondition) {
		return 'The snippet uses a decision check to choose between different execution paths. That branch controls which state transitions are allowed before the final value is produced.';
	}

	if ((questionLower.includes('loop') || questionLower.includes('iteration') || questionLower.includes('each')) && (signals.hasLoop || signals.hasTransformation)) {
		return 'The snippet applies repeated processing to build its output step by step. Each pass contributes part of the final result instead of computing it in a single operation.';
	}

	if ((questionLower.includes('return') || questionLower.includes('output') || questionLower.includes('default')) && signals.hasReturn) {
		return 'The snippet shapes the outgoing value before returning it so callers always receive a predictable structure. This return contract keeps surrounding code simple and less error-prone.';
	}

	if ((questionLower.includes('async') || questionLower.includes('await') || questionLower.includes('request')) && signals.hasAsync) {
		return 'The snippet waits for an asynchronous operation and then continues with the resolved data. This sequencing ensures later logic uses a completed result rather than partial state.';
	}

	if (signals.hasCondition && signals.hasReturn) {
		return 'The snippet combines decision checks with explicit returns to keep behavior deterministic for each branch. That structure prevents invalid states from leaking into later steps.';
	}

	if (signals.hasTransformation) {
		return 'The snippet transforms input data into a new representation before exposing the result. This transformation is the core behavior that prepares data for the next stage of the flow.';
	}

	if (signals.hasTryCatch || signals.hasFallbackDefault) {
		return 'The snippet favors resilience by defining how to continue when expected values are missing or operations fail. That defensive behavior preserves runtime stability for callers.';
	}

	return 'The snippet performs a focused sequence of operations that turns input state into a reliable output. Its key value is not a single syntax element, but how those steps are ordered to maintain correctness.';
}

function buildFallbackHint(code: string, question: string): string {
	const lowered = question.toLowerCase();
	const signals = collectCodeSignals(code);

	if ((lowered.includes('error') || lowered.includes('failure') || lowered.includes('catch')) && (signals.hasTryCatch || signals.hasFallbackDefault)) {
		return 'Focus on what can fail in the main path and how the fallback path preserves a usable return contract.';
	}

	if ((lowered.includes('condition') || lowered.includes('branch') || lowered.includes('decision')) && signals.hasCondition) {
		return 'Look for the single check that decides which path executes and what state each path guarantees.';
	}

	if ((lowered.includes('loop') || lowered.includes('iteration') || lowered.includes('each')) && (signals.hasLoop || signals.hasTransformation)) {
		return 'Track what changes on each pass and how those small changes accumulate into the final output.';
	}

	if ((lowered.includes('return') || lowered.includes('output') || lowered.includes('default')) && signals.hasReturn) {
		return 'Look at the output contract and ask why this shape is safer for callers than returning raw intermediate state.';
	}

	if ((lowered.includes('async') || lowered.includes('await') || lowered.includes('request')) && signals.hasAsync) {
		return 'Identify which step must finish before the rest of the snippet can produce a correct result.';
	}

	if (signals.hasCondition) {
		return 'Focus on the decision point that gates the rest of the logic and why that gate exists.';
	}

	if (signals.hasTransformation || signals.hasLoop) {
		return 'Follow the data shape from start to finish and note where it is transformed into the final result.';
	}

	return 'Focus on the one operation this snippet performs that the rest of the flow depends on being correct.';
}

function buildHintRepairPrompt(rawOutput: string, question: string): string {
	return [
		'Rewrite this into exactly one concise conceptual hint for the learner.',
		'STRICT RULES:',
		'- One sentence only.',
		'- Keep it conceptual; do not mention exact variable, function, API, or table names.',
		'- Do not reveal the answer.',
		'- Keep it directly relevant to the question context.',
		'',
		'Question context:',
		question,
		'',
		'Original hint output:',
		rawOutput
	].join('\n');
}
