export function buildQuizQuestionPrompt(selectedCode: string): string {
	return [
		'You are a code comprehension coach.',
		'Create exactly one beginner-friendly comprehension question about this code.',
		'The question must be short and focus on a single concept only.',
		'No multi-part questions.',
		'Maximum length: 1-2 sentences.',
		'Do not provide the answer.',
		'Return only the question text with no preface, no markdown, and no code.',
		'',
		'Code:',
		selectedCode
	].join('\n');
}

export function buildQuizQuestionRepairPrompt(rawOutput: string, selectedCode: string): string {
	return [
		'Rewrite the following output into exactly one clear beginner-friendly code comprehension question.',
		'STRICT RULES:',
		'- Output exactly one question ending with a question mark.',
		'- No preface, no labels, no markdown, and no code snippets.',
		'- Focus on one concept only and keep it to 1-2 short sentences.',
		'- Do not provide the answer.',
		'',
		'Code context:',
		selectedCode,
		'',
		'Output to repair:',
		rawOutput
	].join('\n');
}

export function buildHintPrompt(code: string, question: string): string {
	return [
		'You are a code comprehension coach.',
		'Give exactly one sentence as a conceptual nudge to help the learner think in the right direction.',
		'Speak directly to the learner in second person.',
		'STRICT RULES:',
		'- Do NOT mention any specific variable names, function names, method names, API names, library names, or table names from the code.',
		'- Do NOT describe what the code does or how it works.',
		'- Do NOT give away the answer or any part of the answer.',
		'- Only point toward the general programming concept or pattern the learner should think about.',
		'- Keep it vague enough that the learner still has to figure out the specifics themselves.',
		'- Make sure the hint is one complete sentence, not cut off.',
		'',
		'GOOD hint example: "Think about what happens when you need to handle both the case where something already exists and the case where it does not."',
		'BAD hint example: "The prisma.users.upsert method finds or creates a user record." (This gives away the answer!)',
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
		'Explain what this specific code does to answer the question, based only on the provided code context.',
		'Reference the actual operations in the code (for example: creating records, looping, condition checks, and saving to the database).',
		'The explanation must be specific enough that someone who has not seen the code still understands exactly what it is doing.',
		'Never give a generic answer that could apply to many code snippets; always anchor your explanation to this code.',
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
		'Rewrite this into a complete, direct explanation of what the specific code is doing to answer the question.',
		'Reference concrete operations from the code flow, such as record creation, looping, checks, or database writes.',
		'Make it specific enough that someone who has not seen the code can still understand exactly what happens.',
		'Never output a generic explanation that could apply to unrelated code.',
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
