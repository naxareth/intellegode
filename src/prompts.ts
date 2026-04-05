export function buildQuizQuestionPrompt(
	selectedCode: string,
	fileContext: string,
	avoidQuestions: string[] = []
): string {
	const lines = [
		'Write one code-comprehension question about the selected snippet.',
		'',
		'STRICT RULES:',
		'- Output ONLY one question and nothing else.',
		'- The question must end with a question mark.',
		'- Mention one exact identifier from the snippet (variable, function, or API call).',
		'- Focus on behavior, purpose, control flow, or consequence within this snippet.',
		'',
		'BAD examples (do not generate these):',
		'- What does this function do? (too broad)',
		'- What language feature is used here? (syntax question, not comprehension)',
		...(avoidQuestions.length >= 2
			? [
				'You have already asked questions about this code. Focus on a DIFFERENT behavior, condition, or operation than the ones listed below. Look at a different part of the snippet.'
			]
			: []),
		...buildAvoidQuestionLines(avoidQuestions),
		'',
		'Selected snippet:',
		selectedCode,
		'',
		'Full file context (for accuracy only — question must be about the snippet):',
		fileContext
	];

	return lines.join('\n');
}

export function buildQuizQuestionRepairPrompt(
	rawOutput: string,
	selectedCode: string,
	fileContext: string,
	avoidQuestions: string[] = []
): string {
	const lines = [
		'Rewrite the malformed output as one valid question about the selected snippet.',
		'',
		'RULES:',
		'- Output ONLY one question ending with a question mark.',
		'- Mention one exact identifier from the snippet.',
		'- No labels, no markdown, no code, and no answer.',
		...buildAvoidQuestionLines(avoidQuestions),
		'',
		'Selected snippet:',
		selectedCode,
		'',
		'Full file context:',
		fileContext,
		'',
		'Output to repair:',
		rawOutput
	];

	return lines.join('\n');
}

export function buildHintPrompt(code: string, question: string): string {
	return [
		'Write one conceptual fill-in-the-blank hint for the learner.',
		'',
		'RULES:',
		'- Output exactly one sentence ending with a period.',
		'- Use this structure: "Focus on how ____ affects ____ before ____."',
		'- Keep the blanks behavior-focused and concept-level (condition, fallback path, output, state).',
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
		'Explain the code behavior that answers the question.',
		'',
		'REQUIREMENTS:',
		'- Use plain English in 1 to 3 sentences.',
		'- Mention at least one exact identifier from the code.',
		'- Do not output labels, grading, or the learner answer.',
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
		'Rewrite the output into a clean explanation for the code question.',
		'RULES:',
		'- Use plain English in 1 to 3 sentences.',
		'- Keep it specific to the code question context.',
		'- Do not output labels, grading, or the learner answer.',
		'',
		'Question context:',
		question,
		'',
		'Original feedback:',
		rawOutput
	].join('\n');
}

function buildAvoidQuestionLines(avoidQuestions: string[]): string[] {
	const cleaned = avoidQuestions
		.map((question) => question.trim())
		.filter((question) => question.length > 0)
		.slice(-6);

	if (cleaned.length === 0) {
		return [];
	}

	const emphasisLine = cleaned.length >= 3
		? ['IMPORTANT: The questions listed above have already been asked. You MUST generate a completely different question focusing on a different part of the code or a different behavior.']
		: [];

	return [
		'Avoid repeating any of these existing questions:',
		...cleaned.map((question) => `- ${question}`),
		...emphasisLine
	];
}
