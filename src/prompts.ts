export function buildQuizQuestionPrompt(selectedCode: string): string {
	return [
		'You are a code comprehension coach.',
		'Create exactly one beginner-friendly comprehension question about this code.',
		'The question must be short and focus on a single concept only.',
		'No multi-part questions.',
		'Maximum length: 1-2 sentences.',
		'Do not provide the answer.',
		'',
		'Code:',
		selectedCode
	].join('\n');
}

export function buildHintPrompt(code: string, question: string): string {
	return [
		'You are a code comprehension coach.',
		'Give one or two complete sentences as a conceptual nudge.',
		'Speak directly to the learner in second person.',
		'Do not mention specific variable names, function names, API names, or implementation details from the code.',
		'Point only toward the underlying concept without giving away the answer.',
		'Make sure the hint is complete and not cut off mid-sentence.',
		'',
		'Code:',
		code,
		'',
		'Question:',
		question
	].join('\n');
}

export function buildEvaluatePrompt(code: string, question: string, answer: string): string {
	return [
		'You are a strict code-comprehension grader.',
		'Compare the learner answer against the actual code and question only.',
		'If the user\'s answer contains the correct function name or key term and a reasonable description, always return [PASS].',
		'Do not require perfect wording when meaning is correct.',
		'Return exactly one line in this format: [PASS|PARTIAL|MISS] feedback',
		'Always write feedback in second person ("You ..."). Never return label only.',
		'[PASS]: one or two sentences saying what they got right and why.',
		'[PARTIAL]: exactly two sentences; sentence 1 what they got right, sentence 2 exactly what was missing.',
		'For [PARTIAL], never say "try again" or "refine your explanation".',
		'[MISS]: one or two sentences with a concrete nudge in the right direction.',
		'Maximum 3 sentences total. Be concise but specific.',
		'Include at least one concrete concept term from the question or learner answer in the feedback.',
		'Never reveal full implementation details or unrelated domain examples.',
		'',
		'Code:',
		code,
		'',
		'Question:',
		question,
		'',
		'User answer:',
		answer
	].join('\n');
}

export function buildEvaluationRepairPrompt(rawOutput: string, question: string, answer: string): string {
	return [
		'Rewrite the feedback into the exact required format.',
		'Required format: [PASS] or [PARTIAL] or [MISS], followed by explanatory text on the same line.',
		'Never return only the label.',
		'Speak in second person ("You ...").',
		'Keep feedback concise, maximum 2 sentences.',
		'Ensure the feedback is relevant to the current question and learner answer.',
		'Do not use unrelated domains or canned phrasing.',
		'Never reveal implementation details or full solution.',
		'',
		'Question context:',
		question,
		'',
		'Learner answer:',
		answer,
		'',
		'Original feedback:',
		rawOutput
	].join('\n');
}
