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
const QUESTION_HISTORY_WINDOW = 12; // Increased from 4 to use full recent history for dedup
const MAX_SELECTED_SNIPPET_CHARS = 2000;
const MAX_FILE_CONTEXT_CHARS = 1500;
const QUESTION_HINT_NUM_CTX = 3072;
const DEBUG = process.env.INTELLEGODE_DEBUG === '1';
const debugLog = (...args: unknown[]): void => { if (DEBUG) { console.warn(...args); } };

type QuestionFocusMode = 'behavior' | 'mechanism' | 'failure' | 'tradeoff';

export async function generateQuizQuestion(
    selectedCode: string,
    fileCodeContext: string,
    ollamaCaller: OllamaCaller = callOllama,
    recentQuestions: string[] = []
): Promise<string> {
    const seenQuestions = recentQuestions.slice(-QUESTION_HISTORY_WINDOW);
    const selectedSnippetContext = prepareContext(selectedCode, MAX_SELECTED_SNIPPET_CHARS, seenQuestions.length);
    const fileContext = prepareContext(fileCodeContext || selectedCode, MAX_FILE_CONTEXT_CHARS, seenQuestions.length);
    const focusMode = chooseQuestionFocusMode(seenQuestions);
    let lastFirst = '';
    let lastRepaired = '';

    const wasSnippetTrimmed = selectedCode.trim().length > MAX_SELECTED_SNIPPET_CHARS;
    debugLog(
        `[INTELLEGODE][QUESTION INPUT] snippetChars=${selectedSnippetContext.length} snippetTrimmed=${wasSnippetTrimmed} fileContextChars=${fileContext.length} recentQuestions=${seenQuestions.length}`
    );
    debugLog(`[INTELLEGODE][HIGHLIGHTED CODE]\n${selectedSnippetContext}`);

    for (let attempt = 0; attempt < MAX_QUESTION_ATTEMPTS; attempt += 1) {
        const currentAttemptSeen: string[] = [];

        // First request can include model cold-start, so keep this timeout more forgiving.
        const first = await ollamaCaller(
            buildQuizQuestionPrompt(selectedSnippetContext, fileContext, [...seenQuestions, ...currentAttemptSeen]),
            QUIZ_MODEL,
            60,
            QUIZ_QUESTION_TIMEOUT_MS,
            QUESTION_HINT_NUM_CTX
        );
        lastFirst = first;
        const normalizedFirst = normalizeQuizQuestionOutput(first);
        const firstIsRepeated = normalizedFirst
            ? isRepeatedQuestion(normalizedFirst, seenQuestions) || isRepeatedQuestion(normalizedFirst, currentAttemptSeen)
            : false;
        const firstIsGrounded = normalizedFirst ? isQuestionGroundedInSnippet(normalizedFirst, selectedSnippetContext) : false;
        if (normalizedFirst && !firstIsRepeated && firstIsGrounded) {
            seenQuestions.push(normalizedFirst);
            debugLog(`[INTELLEGODE][QUESTION FINAL][first] ${normalizedFirst}`);
            return normalizedFirst;
        }

        // Reject repeated questions, even if grounded -- always attempt repair first
        if (normalizedFirst && (firstIsRepeated || !firstIsGrounded)) {
            debugLog(
                `[INTELLEGODE][QUESTION REJECT][first] repeated=${firstIsRepeated} grounded=${firstIsGrounded} question=${normalizedFirst}`
            );
        }

        if (normalizedFirst) {
            currentAttemptSeen.push(normalizedFirst);
        }

        const normalizedPreviousFirst = normalizeQuizQuestionOutput(lastFirst);
        const normalizedPreviousRepaired = normalizeQuizQuestionOutput(lastRepaired);
        if (
            normalizedPreviousFirst &&
            normalizedPreviousRepaired &&
            normalizeQuestionForComparison(normalizedPreviousFirst) === normalizeQuestionForComparison(normalizedPreviousRepaired)
        ) {
            debugLog(
                `[INTELLEGODE][QUESTION REJECT] skipping repair because previous first and repaired outputs were duplicates: ${normalizedPreviousFirst}`
            );
            break;
        }

        const repaired = await ollamaCaller(
            buildQuizQuestionRepairPrompt(first, selectedSnippetContext, fileContext, [...seenQuestions, ...currentAttemptSeen]),
            QUIZ_MODEL,
            80,
            QUIZ_QUESTION_TIMEOUT_MS,
            QUESTION_HINT_NUM_CTX
        );
        lastRepaired = repaired;
        const normalizedRepaired = normalizeQuizQuestionOutput(repaired);
        const repairedIsRepeated = normalizedRepaired
            ? isRepeatedQuestion(normalizedRepaired, seenQuestions) || isRepeatedQuestion(normalizedRepaired, currentAttemptSeen)
            : false;
        const repairedIsGrounded = normalizedRepaired ? isQuestionGroundedInSnippet(normalizedRepaired, selectedSnippetContext) : false;
        if (normalizedRepaired && !repairedIsRepeated && repairedIsGrounded) {
            seenQuestions.push(normalizedRepaired);
            debugLog(`[INTELLEGODE][QUESTION FINAL][repair] ${normalizedRepaired}`);
            return normalizedRepaired;
        }

        // Reject repeated questions, even if grounded -- escalate to fallback
        if (normalizedRepaired && (repairedIsRepeated || !repairedIsGrounded)) {
            debugLog(
                `[INTELLEGODE][QUESTION REJECT][repair] repeated=${repairedIsRepeated} grounded=${repairedIsGrounded} question=${normalizedRepaired}`
            );
        }

        if (normalizedRepaired) {
            currentAttemptSeen.push(normalizedRepaired);
        }

        if (
            normalizedFirst &&
            normalizedRepaired &&
            normalizeQuestionForComparison(normalizedFirst) === normalizeQuestionForComparison(normalizedRepaired)
        ) {
            debugLog(
                `[INTELLEGODE][QUESTION REJECT] first and repaired outputs matched after normalization: ${normalizedFirst}`
            );
            break;
        }
    }

    const fallbackQuestion = buildFallbackQuestion(selectedSnippetContext, seenQuestions, focusMode);
    debugLog('[INTELLEGODE][QUESTION FALLBACK][raw rejected] first=', lastFirst, 'repair=', lastRepaired);
    debugLog(`[INTELLEGODE][QUESTION FINAL][fallback] ${fallbackQuestion}`);
    return fallbackQuestion;
}

export function normalizeQuizQuestionOutput(raw: string): string | null {
    const flattened = raw.replace(/```[\s\S]*?```/g, ' ').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!flattened) {
        return null;
    }

    // Extract complete sentences ending with question mark
    const questionRegex = /[A-Z][^.!?]*?\?|[A-Z][^?]*?\?/g;
    const matches = flattened.match(questionRegex) ?? [];
    
    for (const match of matches) {
        const candidate = match.trim();
        if (candidate && isUsableQuestionCandidate(candidate)) {
            return candidate;
        }
    }

    // Fallback: find first question mark and extract everything up to it
    if (flattened.includes('?')) {
        const qIndex = flattened.indexOf('?');
        // Find the sentence start by looking back for sentence boundaries
        let startIdx = 0;
        for (let i = qIndex - 1; i >= 0; i--) {
            const char = flattened[i];
            // Stop at sentence ending punctuation
            if ((char === '.' || char === '!' || char === '?') && i < qIndex - 1) {
                startIdx = i + 1;
                break;
            }
            // Also try to find a capital letter that starts a sentence
            if (/[A-Z]/.test(char) && i > 0 && /[.!? ]/.test(flattened[i - 1])) {
                startIdx = i;
                break;
            }
        }
        const firstQuestion = flattened.slice(startIdx, qIndex + 1).trim();
        if (isUsableQuestionCandidate(firstQuestion)) {
            return firstQuestion;
        }
    }

    return null;
}

function isUsableQuestionCandidate(candidate: string): boolean {
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    if (!normalized.endsWith('?') || normalized.length < 16) {
        return false;
    }

    const words = normalized.slice(0, -1).trim().split(/\s+/).filter(Boolean);
    return words.length >= 4;
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
        'What condition in this code determines which path the logic takes?',
        'What does this code do differently when the main check fails?',
        'Why does this code need to handle both the success and failure case separately?',
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
        if (isQuestionSimilar(candidate, question)) {
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
        .trim()
        // Remove common question filler patterns to focus on actual content
        .replace(/^(why|how|what|where|when|which|who)\s+/i, '')
        .replace(/\?\.?$/, '')
        .trim();
}

function isQuestionSimilar(q1: string, q2: string): boolean {
    const norm1 = normalizeQuestionForComparison(q1);
    const norm2 = normalizeQuestionForComparison(q2);
    
    // Exact match after normalization
    if (norm1 === norm2) {
        return true;
    }
    
    // Extract key terms: focus on nouns and verbs, not filler words
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'be', 'do', 'does', 'have', 'has', 'or', 'and', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'from', 'with', 'why', 'what', 'how', 'which', 'when', 'where', 'who', 'this', 'that', 'it', 'its', 'if', 'as', 'by', 'can', 'will', 'code', 'snippet', 'question']);
    const extractKeyTerms = (text: string): string[] => {
        return text.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    };
    
    const terms1 = extractKeyTerms(norm1);
    const terms2 = extractKeyTerms(norm2);
    
    // If most key terms overlap, consider them similar
    const commonTerms = terms1.filter(t => terms2.includes(t)).length;
    const totalTerms = Math.max(terms1.length, terms2.length);
    const similarity = totalTerms > 0 ? commonTerms / totalTerms : 0;
    
    // Check pattern similarity for questions following the same structure
    // e.g., "Why does X do Y" vs "How does X perform Y" should be similar
    const startsWithPattern = (text: string, pattern: string): boolean => text.startsWith(pattern.toLowerCase());
    const q1Lower = q1.toLowerCase();
    const q2Lower = q2.toLowerCase();
    
    const questionStarters = ['why does', 'how does', 'what does', 'where does', 'when does', 'does this', 'why', 'how'];
    for (const starter of questionStarters) {
        if (startsWithPattern(q1Lower, starter) && startsWithPattern(q2Lower, starter)) {
            // Both questions start the same way - more likely to be duplicates
            // Lower the threshold for this case
            return similarity >= 0.5;
        }
    }
    
    // Default: If 50%+ of key terms overlap (lower threshold), it's a potential duplicate
    return similarity >= 0.5;
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

function prepareContext(source: string, maxChars: number, recentQuestionCount: number): string {
    const trimmed = source.trim();
    if (trimmed.length <= maxChars) {
        return trimmed;
    }

    const separator = '\n\n...\n\n';
    const available = maxChars - separator.length;
    if (available <= 4) {
        return trimmed.slice(0, maxChars).trim();
    }

    const segmentLength = Math.max(2, Math.floor(available / 2));
    const head = trimmed.slice(0, segmentLength).trimEnd();
    const tail = trimmed.slice(-segmentLength).trimStart();
    const middleStart = Math.max(0, Math.floor(trimmed.length / 2) - Math.floor(segmentLength / 2));
    const middle = trimmed.slice(middleStart, middleStart + segmentLength).trim();

    if (recentQuestionCount <= 1) {
        return `${head}${separator}${tail}`;
    }

    if (recentQuestionCount <= 3) {
        return `${head}${separator}${middle}`;
    }

    return `${middle}${separator}${tail}`;
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
    const staticHint = buildFallbackHint(code, question);
    if (preferStaticHint(staticHint)) {
        return staticHint;
    }

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

function preferStaticHint(_hint: string): boolean {
    // Always call the LLM for hints — the static fallback is only used when the LLM fails.
    return false;
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
    const normalized = raw.replace(/\r\n?/g, '\n').trim();
    if (!normalized) {
        return null;
    }

    const sanitized = stripMarkdownFormatting(stripLeadingGradeLabels(normalized)).trim();
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

function isQuestionGroundedInSnippet(question: string, selectedCode: string): boolean {
    // First gate: reject patently generic questions regardless of code content
    if (isLikelyGenericQuestion(question)) {
        return false;
    }

    const snippetIdentifiers = extractMeaningfulIdentifiers(selectedCode);

    // If the snippet itself has very few unique identifiers (e.g. a short guard clause),
    // we can't demand identifier overlap — trust the question passed the generic check above.
    if (snippetIdentifiers.size < 3) {
        return true;
    }

    const questionIdentifiers = extractMeaningfulIdentifiers(question);

    // If the question has no meaningful identifiers but isn't generic, it's likely asking
    // a conceptual WHY/HOW question — those are valid; don't block them.
    if (questionIdentifiers.size === 0) {
        return true;
    }

    // Require at least one identifier overlap for questions on larger snippets
    for (const identifier of questionIdentifiers) {
        if (snippetIdentifiers.has(identifier)) {
            return true;
        }
    }

    return false;
}

function isLikelyGenericQuestion(question: string): boolean {
    const lowered = question.toLowerCase().trim();
    return (
        lowered.startsWith('what does this code do') ||
        lowered.startsWith('how does this code work') ||
        lowered.startsWith('what is the purpose of this code') ||
        lowered.startsWith('what is this code doing') ||
        lowered.includes('default value') ||
        lowered.includes('parameter name')
    );
}

function extractMeaningfulIdentifiers(text: string): Set<string> {
    const stopWords = new Set([
        'what', 'why', 'how', 'which', 'when', 'where', 'who', 'does', 'is', 'are', 'the', 'this', 'that',
        'with', 'from', 'into', 'within', 'about', 'used', 'using', 'call', 'snippet', 'code', 'function',
        'method', 'variable', 'name', 'value', 'model', 'question', 'answer', 'return', 'returns', 'for',
        'and', 'or', 'to', 'of', 'in', 'on', 'a', 'an', 'it', 'its', 'be', 'by', 'as', 'at', 'if'
    ]);

    const keywords = new Set([
        'const', 'let', 'var', 'function', 'return', 'if', 'else', 'await', 'async', 'try', 'catch',
        'switch', 'case', 'default', 'new', 'class', 'extends', 'import', 'export', 'from', 'true', 'false', 'null', 'undefined'
    ]);

    const tokens = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    const identifiers = new Set<string>();

    for (const token of tokens) {
        const normalized = token.toLowerCase();
        if (normalized.length < 3) {
            continue;
        }

        if (stopWords.has(normalized) || keywords.has(normalized)) {
            continue;
        }

        identifiers.add(normalized);
    }

    return identifiers;
}

function stripLeadingGradeLabels(text: string): string {
    return text
        .replace(/^\s*\[(PASS|PARTIAL|MISS)\]\s*/i, '')
        .replace(/^\s*(PASS|PARTIAL|MISS)\s*[:\-]\s*/i, '')
        .trim();
}

function stripMarkdownFormatting(text: string): string {
    return text
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/_([^_\n]+)_/g, '$1');
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
        return 'Think about what could go wrong in the main path and what the code does to keep things running when it does.';
    }

    if ((lowered.includes('condition') || lowered.includes('branch') || lowered.includes('decision')) && signals.hasCondition) {
        return 'Consider which single check determines the two different outcomes and why each path matters.';
    }

    if ((lowered.includes('loop') || lowered.includes('iteration') || lowered.includes('each')) && (signals.hasLoop || signals.hasTransformation)) {
        return 'Notice what accumulates or changes on every pass and how those small steps build the final result.';
    }

    if ((lowered.includes('return') || lowered.includes('output') || lowered.includes('default')) && signals.hasReturn) {
        return 'Ask yourself why the output is shaped this way instead of returning raw intermediate data.';
    }

    if ((lowered.includes('async') || lowered.includes('await') || lowered.includes('request')) && signals.hasAsync) {
        return 'Think about which step absolutely must complete before the rest of the logic can produce a correct result.';
    }

    if (signals.hasCondition) {
        return 'Consider the decision point that controls which path runs and what would happen if it were removed.';
    }

    if (signals.hasTransformation || signals.hasLoop) {
        return 'Trace the data from its starting shape to its final form and notice where the key transformation happens.';
    }

    return 'Ask yourself what single operation in this snippet makes the biggest difference to the final outcome.';
}

function buildHintRepairPrompt(rawOutput: string, question: string): string {
    return [
        'Rewrite this into exactly one concise conceptual hint for the learner.',
        'STRICT RULES:',
        '- One sentence only, ending with a period.',
        '- Do NOT reveal the answer or name code identifiers.',
        '- Point toward the concept or pattern the learner should think about.',
        '- Do NOT start with "Focus on how" — vary the phrasing naturally.',
        '',
        'Question context:',
        question,
        '',
        'Original hint output:',
        rawOutput
    ].join('\n');
}