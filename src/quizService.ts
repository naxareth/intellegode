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

const QUIZ_QUESTION_TIMEOUT_MS = 60000;
const HINT_FIRST_ATTEMPT_TIMEOUT_MS = 18000;
const HINT_SECOND_ATTEMPT_TIMEOUT_MS = 22000;
const QUIZ_MODEL = 'qwen3.5:4b';
const MIN_EXPLANATION_WORDS = 10;
const MIN_HINT_WORDS = 8;
const MAX_HINT_WORDS = 50;
const MAX_QUESTION_ATTEMPTS = 2;
const QUESTION_HISTORY_WINDOW = 8;
const MAX_SELECTED_SNIPPET_CHARS = 2400;
const MAX_FILE_CONTEXT_CHARS = 3600;
const QUESTION_HINT_NUM_CTX = 2048;


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
			QUIZ_MODEL,
			60,
			QUIZ_QUESTION_TIMEOUT_MS,
			QUESTION_HINT_NUM_CTX
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
			QUIZ_MODEL,
			80,
			QUIZ_QUESTION_TIMEOUT_MS,
			QUESTION_HINT_NUM_CTX
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

	// Detect specific patterns in order of specificity
	if (/math\.(max|min|log|log2|floor|ceil|round|abs|pow|sqrt)/i.test(selectedCode)) {
		return pickNonRepeatedQuestion(
			[
				'Why does this code apply a mathematical transformation instead of using the raw value directly?',
				'How does the math operation here change the scale or range of the input value?',
				'What would go wrong if this calculation were skipped and the untransformed value were used instead?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('async ') || codeLower.includes('await ') || codeLower.includes('.then(')) {
		return pickNonRepeatedQuestion(
			[
				'Why does this operation need to be asynchronous instead of completing immediately?',
				'What external resource or slow process does this code wait for before continuing?',
				'How does the async flow here prevent the program from blocking while it waits?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('try {') || codeLower.includes('catch')) {
		return pickNonRepeatedQuestion(
			[
				'What specific failure could trigger the error-handling path in this code?',
				'How does the recovery behavior differ from the normal success path here?',
				'Why is it important to catch errors at this point rather than letting them propagate?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('return ')) {
		return pickNonRepeatedQuestion(
			[
				'What transformation does this code apply to its inputs before returning the final value?',
				'Why is the returned value computed this way instead of being passed through unchanged?',
				'How does the return value here get used by the code that calls this function?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('if') || codeLower.includes('else')) {
		return pickNonRepeatedQuestion(
			[
				'What specific condition determines which execution path the code takes here?',
				'What different outcomes result from the conditional check passing versus failing?',
				'Why does this decision check need to happen before the rest of the logic can proceed?'
			],
			recentQuestions,
			selectedCode
		);
	}

	if (codeLower.includes('for (') || codeLower.includes('while (') || codeLower.includes('.map(') || codeLower.includes('.filter(') || codeLower.includes('.reduce(')) {
		return pickNonRepeatedQuestion(
			[
				'What transformation does each iteration apply, and how do those steps combine into the final result?',
				'Why does this code process items one by one in a loop instead of handling the entire collection at once?',
				'What accumulates or changes on every pass through this loop to produce the end result?'
			],
			recentQuestions,
			selectedCode
		);
	}

	// Extract function names to make the generic fallback more specific
	const funcMatch = selectedCode.match(/function\s+(\w+)/i);
	if (funcMatch) {
		const funcName = funcMatch[1];
		return pickNonRepeatedQuestion(
			[
				`What specific data transformation does ${funcName} perform on its input?`,
				`Why is the logic in ${funcName} necessary — what would break if it were removed?`,
				`How does ${funcName} ensure the output is valid for the code that depends on it?`
			],
			recentQuestions,
			selectedCode
		);
	}

	return pickNonRepeatedQuestion(
		[
			'What specific input does this code receive, and how does it transform that input before producing output?',
			'What would break or behave differently if this block of code were removed entirely?',
			'What is the one key operation this code performs that the rest of the program depends on?'
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

	// Detect concrete patterns in the code and build specific fallbacks
	const patterns: string[] = [];

	// Look for specific named functions
	const funcMatch = code.match(/function\s+(\w+)/i);
	const funcName = funcMatch ? funcMatch[1] : null;

	// Check for math operations
	const mathMatch = code.match(/Math\.(max|min|log|log2|floor|ceil|round|abs|pow|sqrt)/i);
	if (mathMatch) {
		patterns.push(`applies Math.${mathMatch[1]} to transform or constrain a numeric value`);
	}

	// Check for clamping patterns (Math.max + Math.min combo)
	if (/Math\.max/.test(code) && /Math\.min/.test(code)) {
		patterns.push('clamps the value to a fixed range so extreme inputs cannot distort the result');
	}

	// Check for return with computation
	if (/return\s+[^;]+[+\-*/]/.test(code)) {
		patterns.push('computes a derived value through arithmetic before returning it');
	}

	// Check for array methods
	if (/\.(map|filter|reduce|forEach|find|some|every)\s*\(/.test(code)) {
		const arrayMethod = code.match(/\.(map|filter|reduce|forEach|find|some|every)\s*\(/)?.[1];
		patterns.push(`uses .${arrayMethod}() to process each item in a collection`);
	}

	// Check for async/await
	if (/\bawait\s/.test(code)) {
		patterns.push('awaits an asynchronous operation before proceeding with the result');
	}

	const asksAboutUpdate = /\b(update|updat|upsert|field|column|record|row|table|database)\b/.test(questionLower);
	if (asksAboutUpdate) {
		return `The code writes updated data to storage so all subsequent operations work with the latest state instead of stale values.${patterns.length > 0 ? ` Specifically, it ${patterns[0]}.` : ''} This prevents downstream logic from making decisions based on outdated information.`;
	}

	if (questionLower.includes('condition') || questionLower.includes('branch') || codeLower.includes('if (') || codeLower.includes('else')) {
		const condMatch = code.match(/if\s*\(([^)]{1,60})\)/)?.[1];
		const condDesc = condMatch ? ` by testing whether \`${condMatch.trim()}\`` : '';
		return `The code uses a conditional check${condDesc} to decide which execution path runs next.${patterns.length > 0 ? ` Along the way, it ${patterns[0]}.` : ''} The branch ensures only the correct logic executes for the current state.`;
	}

	if (codeLower.includes('for (') || codeLower.includes('while (') || codeLower.includes('.map(') || codeLower.includes('.reduce(')) {
		return `The code iterates over a collection, applying a transformation to each item in sequence.${patterns.length > 0 ? ` On each pass, it ${patterns[0]}.` : ''} The final result is assembled from the combined effect of all iterations.`;
	}

	if (codeLower.includes('try {') || codeLower.includes('catch')) {
		return `The code wraps a risky operation in error handling so that failures are caught and managed instead of crashing the program.${patterns.length > 0 ? ` Inside the protected block, it ${patterns[0]}.` : ''} The catch path provides a recovery or fallback when the primary operation fails.`;
	}

	// Use detected patterns to build a more specific generic fallback
	if (patterns.length >= 2) {
		return `The code ${patterns[0]}, then ${patterns[1]}. These steps work together to produce a reliable output from the given input.`;
	}

	if (patterns.length === 1) {
		return `The code ${patterns[0]}. This operation transforms the input into the specific output that the rest of the program depends on.`;
	}

	if (funcName) {
		return `The function ${funcName} processes its input by applying a series of transformations and checks. The result it returns is shaped so that downstream code can rely on it being in the expected format and range.`;
	}

	return 'The code transforms its input through a specific sequence of operations, where each step refines or validates the data before the next step uses it. The final output reflects the combined effect of all those transformations.';
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
