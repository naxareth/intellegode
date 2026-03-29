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
		'You are a code comprehension explainer.',
		'Generate the correct explanation for the question using the provided code context.',
		'Do not grade the user answer and do not output labels like [PASS], [PARTIAL], or [MISS].',
		'Write a clear explanation in 2-3 concise sentences.',
		'Focus on the key concept and why it matters in this code.',
		'You may reference the user answer only to clarify what should be understood.',
		'Avoid unrelated domains and avoid unnecessary implementation minutiae.',
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
		'Rewrite this into a complete, clear explanation of the correct answer.',
		'Output only 2-3 concise sentences.',
		'Do not output grades or labels.',
		'Keep it relevant to the question context.',
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
