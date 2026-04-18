export function buildQuizQuestionPrompt(
	selectedCode: string,
	fileContext: string,
	avoidQuestions: string[] = []
): string {
	const lines = [
		"You are a strict but fair Senior Staff Software Engineer reviewing a Junior Developer's Pull Request.",
		'Write one code-comprehension question about the selected snippet.',
		'',
		'STRICT RULES:',
		'- Output ONLY one question and nothing else.',
		'- The question must end with a question mark.',
		'- Mention one exact identifier from the snippet (variable, function, or API call).',
		"- Focus on WHY the code is structured this way, not just WHAT it does.",
		"- Ask about PURPOSE: Why use this approach? Why call this function? Why check this condition?",
		"- Ask about CONSEQUENCE: What changes if you modify this line? What happens when this flow completes?",
		"- Ask about INTEGRATION: How does this connect to the broader logic? What assumptions does it make?",
		"- Ask about DESIGN: Why not do it differently? What tradeoff is being made here?",
		"- Do NOT ask basic syntax questions (e.g., 'What does the || operator do?').",
		"- Do NOT ask about generic edge cases (e.g., 'What if X is null?') unless deeply tied to the code's logic.",
		'',
		'GOOD question examples:',
		'- Why does this code fetch the schema before building the prompt?',
		'- What assumption about the response format is this code making?',
		'- Why would the model.generateContent() call need access to both skillExtractionPrompt and dynamicPrompt?',
		'- What happens to the extracted skills if the parsing fails?',
		'- Why does the function use the schema context instead of querying the model directly?',
		'',
		'BAD examples (do not generate these):',
		'- What does this function do? (too broad/vague)',
		'- What is JSON.parse()? (syntax question)',
		'- What if the URL is invalid? (generic what-if)',
		...(avoidQuestions.length >= 2
			? [
				'You have already asked questions about this code. Focus on a DIFFERENT aspect: purpose, design choice, data flow, or integration point than the ones listed below.'
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
		'Rewrite the malformed or low-quality output as one valid, insightful question about the selected snippet.',
		'',
		'QUALITY RULES:',
		'- Output ONLY one question ending with a question mark.',
		'- Mention one exact identifier from the snippet.',
		'- Ask WHY the code is written this way, not just WHAT it does.',
		'- Ask about PURPOSE, CONSEQUENCE, INTEGRATION, or DESIGN -- not generic edge cases.',
		'- Do NOT generate questions like "What if X is null?" unless absolutely core to understanding the logic.',
		...buildAvoidQuestionLines(avoidQuestions),
		'',
		'Selected snippet:',
		selectedCode,
		'',
		'Full file context:',
		fileContext,
		'',
		'Low-quality original:',
		rawOutput
	];

	return lines.join('\n');
}

export function buildHintPrompt(code: string, question: string): string {
	return [
		'Act as a senior engineer pair-programming with a learner.',
		'Provide one insightful, conceptual hint to help them answer the question about the provided code snippet.',
		'',
		'RULES:',
		'- Be conversational but concise (1-2 short sentences max).',
		'- Explain *what to look for* or conceptually *what is happening*, but do NOT give away the final answer.',
		'- Guide their attention to the right part of the code or the right design pattern.',
		'- You have full freedom in how you phrase the hint. Make it natural and helpful.',
		'- ABSOLUTELY DO NOT use phrases like "Think about", "Consider how", "Notice the", "Focus on". Be extremely varied and creative in your sentence structure.',
		'- AVOID robotic and repetitive templates. Speak naturally.',
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
		"Evaluate the Junior Developer's answer like a Senior Staff Engineer.",
		'',
		'REQUIREMENTS:',
		'- Use plain English in 1 to 3 sentences.',
		'- Mention at least one exact identifier from the code.',
		"- Briefly validate what they got right, but explicitly point out the deeper architectural 'why' or edge case they missed.",
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
