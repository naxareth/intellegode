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
const MIN_EXPLANATION_WORDS = 10;
const MIN_HINT_WORDS = 8;
const MAX_HINT_WORDS = 50;
const MAX_QUESTION_ATTEMPTS = 3;
const QUESTION_HISTORY_WINDOW = 8;
const MAX_SELECTED_SNIPPET_CHARS = 1800;
const MAX_FILE_CONTEXT_CHARS = 3600;


export async function generateQuizQuestion(
	selectedCode: string,
	fileCodeContext: string,
	ollamaCaller: OllamaCaller = callOllama,
	recentQuestions: string[] = []
): Promise<string> {
	const selectedSnippetContext = prepareContext(selectedCode, MAX_SELECTED_SNIPPET_CHARS);
	const fileContext = prepareContext(fileCodeContext || selectedCode, MAX_FILE_CONTEXT_CHARS);
	const seenQuestions = recentQuestions.slice(-QUESTION_HISTORY_WINDOW);

	for (let attempt = 0; attempt < MAX_QUESTION_ATTEMPTS; attempt += 1) {
		// First request can include model cold-start, so keep this timeout more forgiving.
		const first = await ollamaCaller(
			buildQuizQuestionPrompt(selectedSnippetContext, fileContext, seenQuestions),
			undefined,
			60,
			QUIZ_QUESTION_TIMEOUT_MS
		);
		const normalizedFirst = normalizeQuizQuestionOutput(first);
		if (normalizedFirst && !isRepeatedQuestion(normalizedFirst, seenQuestions)) {
			return normalizedFirst;
		}

		if (normalizedFirst) {
			seenQuestions.push(normalizedFirst);
		}

		const repaired = await ollamaCaller(
			buildQuizQuestionRepairPrompt(first, selectedSnippetContext, fileContext, seenQuestions),
			undefined,
			80,
			QUIZ_QUESTION_TIMEOUT_MS
		);
		const normalizedRepaired = normalizeQuizQuestionOutput(repaired);
		if (normalizedRepaired && !isRepeatedQuestion(normalizedRepaired, seenQuestions)) {
			return normalizedRepaired;
		}

		if (normalizedRepaired) {
			seenQuestions.push(normalizedRepaired);
		}
	}

	return buildFallbackQuestion(selectedSnippetContext, seenQuestions);
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

function buildFallbackQuestion(selectedCode: string, recentQuestions: string[]): string {
	const codeLower = selectedCode.toLowerCase();
	if (codeLower.includes('if') || codeLower.includes('else')) {
		return pickNonRepeatedQuestion(
			[
				'Why does this decision check need to happen before the rest of the logic continues?',
				'How does this conditional guard change what work the code performs next?',
				'What behavior differs when the decision check evaluates true versus false?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('for (') || codeLower.includes('while (') || codeLower.includes('.map(')) {
		return pickNonRepeatedQuestion(
			[
				'What repeated step in this loop drives the final result?',
				'How does each iteration move the program closer to its outcome?',
				'What is the key transformation that happens on every pass through this loop?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('try {') || codeLower.includes('catch')) {
		return pickNonRepeatedQuestion(
			[
				'How does this code keep execution safe when something fails?',
				'What recovery behavior is triggered when an operation throws an error?',
				'How does the error-handling path differ from the success path here?'
			],
			recentQuestions,
			selectedCode
		);
	}

	return pickNonRepeatedQuestion(
		[
			'What is the most important behavior this code is responsible for?',
			'What single outcome is this code trying to guarantee?',
			'What core purpose does this block serve in the larger flow?'
		],
		recentQuestions,
		selectedCode
	);
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

export async function generateHint(code: string, question: string, ollamaCaller: OllamaCaller = callOllama): Promise<string> {
	const first = await ollamaCaller(buildHintPrompt(code, question), undefined, 120, HINT_FIRST_ATTEMPT_TIMEOUT_MS);
	const normalizedFirst = normalizeHintOutput(first);
	if (normalizedFirst) {
		return normalizedFirst;
	}

	const repaired = await ollamaCaller(
		buildHintRepairPrompt(first, question),
		undefined,
		120,
		HINT_SECOND_ATTEMPT_TIMEOUT_MS
	);
	const normalizedRepaired = normalizeHintOutput(repaired);
	if (normalizedRepaired) {
		return normalizedRepaired;
	}

	const second = await ollamaCaller(buildHintPrompt(code, question), undefined, 180, HINT_SECOND_ATTEMPT_TIMEOUT_MS);
	const normalizedSecond = normalizeHintOutput(second);
	if (normalizedSecond) {
		return normalizedSecond;
	}

	return buildFallbackHint(question);
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

	return buildGroundedFallbackExplanation(code, question);
}

export function normalizeExplanationOutput(raw: string): string | null {
	const oneLine = raw.replace(/\r?\n+/g, ' ').trim();
	if (!oneLine) {
		return null;
	}

	const sanitized = limitToSentences(stripLeadingGradeLabels(oneLine), 2);
	if (!sanitized) {
		return null;
	}

	if (!isValidExplanationOutput(sanitized)) {
		return null;
	}

	return sanitized;
}

export function normalizeHintOutput(raw: string): string | null {
	const flattened = raw.replace(/\r?\n+/g, ' ').trim();
	if (!flattened) {
		return null;
	}

	const sanitized = flattened
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/\*\*/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (!sanitized) {
		return null;
	}

	const sentenceMatch = sanitized.match(/[^.!?]{10,220}[.!?]/g) ?? [];
	const primarySentence = sentenceMatch.length > 0 ? sentenceMatch[0]!.trim() : sanitized;
	const withoutLeadingList = primarySentence
		.replace(/^\s*[-*\d.\)\s]+/, '')
		.replace(/^\s*in the provided code\s*,?\s*/i, '')
		.trim();

	if (!withoutLeadingList) {
		return null;
	}

	if (/\b(import|function|class|const|let|var|return|if\s*\(|for\s*\(|while\s*\()/i.test(withoutLeadingList)) {
		return null;
	}

	if (/[A-Za-z]+_[A-Za-z]+/.test(withoutLeadingList) || /[A-Za-z]+\.[A-Za-z]+/.test(withoutLeadingList)) {
		return null;
	}

	const words = withoutLeadingList.split(/\s+/).filter(Boolean);
	if (words.length < MIN_HINT_WORDS) {
		return null;
	}

	const clipped = words.slice(0, MAX_HINT_WORDS).join(' ').replace(/[,:;\-\s]+$/, '').trim();
	if (!clipped) {
		return null;
	}

	return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
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

export function isContextuallyRelevant(feedback: string, question: string, codeContext: string = ''): boolean {
	const feedbackTerms = extractKeyTerms(feedback);
	const contextTerms = mergeContextTerms(question, codeContext);

	if (feedbackTerms.size === 0 || contextTerms.size === 0) {
		return true;
	}

	for (const term of feedbackTerms) {
		if (contextTerms.has(term)) {
			return true;
		}
	}

	return hasStemOverlap(feedbackTerms, contextTerms);
}

function mergeContextTerms(question: string, codeContext: string): Set<string> {
	const merged = new Set<string>();
	for (const term of extractKeyTerms(question)) {
		merged.add(term);
	}

	for (const term of extractKeyTerms(codeContext)) {
		merged.add(term);
	}

	return merged;
}

function hasStemOverlap(feedbackTerms: Set<string>, contextTerms: Set<string>): boolean {
	for (const contextTerm of contextTerms) {
		if (contextTerm.length < 5) {
			continue;
		}

		const contextStem = contextTerm.slice(0, 5);
		for (const feedbackTerm of feedbackTerms) {
			if (feedbackTerm.length < 5) {
				continue;
			}

			const feedbackStem = feedbackTerm.slice(0, 5);
			if (contextStem === feedbackStem) {
				return true;
			}
		}
	}

	return false;
}

function extractKeyTerms(text: string): Set<string> {
	const withCamelSplit = text.replace(/([a-z])([A-Z])/g, '$1 $2');
	const stopWords = new Set([
		'the', 'this', 'that', 'with', 'from', 'your', 'you', 'about', 'into', 'what', 'when', 'where', 'which',
		'because', 'would', 'could', 'should', 'their', 'there', 'these', 'those', 'have', 'has', 'were', 'been',
		'for', 'and', 'are', 'not', 'but', 'all', 'any', 'one', 'two', 'step', 'code', 'idea', 'part', 'main', 'here'
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
	const asksAboutUpdate = /\b(update|updat|upsert|field|column|record|row|table|database)\b/.test(questionLower);
	if (asksAboutUpdate) {
		return 'The code updates an existing stored value so later logic reads the latest state instead of stale data. That update keeps related operations consistent and prevents decisions from being made using outdated information.';
	}

	if (questionLower.includes('condition') || questionLower.includes('branch') || codeLower.includes('if (') || codeLower.includes('else')) {
		return 'The code evaluates decision checks and chooses the execution path based on which conditions are true. That branching behavior controls when each block of logic runs and prevents the wrong path from executing.';
	}

	if (codeLower.includes('for (') || codeLower.includes('while (') || codeLower.includes('.map(') || codeLower.includes('.reduce(')) {
		return 'The code repeats a core operation across a collection so each item is processed in a consistent way. The final outcome is built from the combined effect of those repeated steps.';
	}

	return 'The code performs a sequence of checks and operations to transform input into a reliable result. The key behavior is that each step prepares the state needed for the next step to work correctly.';
}

function buildFallbackHint(question: string): string {
	const lowered = question.toLowerCase();
	if (/\b(update|field|column|record|row|table|database)\b/.test(lowered)) {
		return 'Think about why the code must write a new value before later steps can safely trust and use that data.';
	}

	if (lowered.includes('condition') || lowered.includes('branch')) {
		return 'Focus on what boolean check must be true before the code takes each path.';
	}

	if (lowered.includes('loop') || lowered.includes('iterate')) {
		return 'Track what changes on each pass and what final result those repeated steps build.';
	}

	if (lowered.includes('upsert') || lowered.includes('create') || lowered.includes('update')) {
		return 'Think about how the logic handles both already-existing data and newly-missing data.';
	}

	return 'Focus on the key decision or state change that controls the overall behavior in this code.';
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
