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

export function buildEvaluatePrompt(code: string, question: string): string {
	return [
		'You are a code comprehension explainer.',
		'Explain the correct answer to the question directly from the code context.',
		'Never reference, quote, or repeat the learner answer.',
		'Write as a senior developer teaching a junior: direct, plain English, minimal jargon.',
		'Use a maximum of 2 sentences.',
		'Do not restate the question.',
		'Do not start with "The purpose of".',
		'Do not output labels like [PASS], [PARTIAL], or [MISS].',
		'',
		'Code:',
		code,
		'',
		'Question:',
		question,
		'',
		'Correct explanation:'
	].join('\n');
}

export function buildEvaluationRepairPrompt(rawOutput: string, question: string): string {
	return [
		'Rewrite this into a complete, direct explanation of the correct answer.',
		'Never reference, quote, or repeat any learner answer.',
		'Use plain English and keep jargon minimal.',
		'Use a maximum of 2 sentences.',
		'Do not restate the question.',
		'Do not start with "The purpose of".',
		'Do not output grades or labels.',
		'Keep it relevant to the provided code question context.',
		'',
		'Question context:',
		question,
		'',
		'Original feedback:',
		rawOutput
	].join('\n');
}
