export function buildQuizQuestionPrompt(selectedCode: string, fileContext: string, avoidQuestions: string[] = []): string {
	const lines = [
		'You are a code comprehension coach helping a developer truly understand their own code.',
		'',
		'YOUR TASK:',
		'1. Read the selected snippet carefully.',
		'2. Identify the single most important concrete operation it performs (for example: a calculation, a data transformation, a conditional guard, a loop accumulation, an API call, error handling).',
		'3. Write exactly one short question that asks the learner to explain WHY or HOW that specific operation works.',
		'',
		'STRICT RULES:',
		'- The question MUST reference a specific behavior visible in the snippet, not a vague "purpose".',
		'- Do NOT ask "What is the purpose of this code?" or "What does this block do?" — those are too generic.',
		'- Do NOT ask about syntax, variable names, or language features.',
		'- Maximum 1-2 sentences. End with a question mark.',
		'- No markdown, no code, no preface. Return only the question text.',
		'',
		'GOOD question examples:',
		'- "Why does the function clamp the slope value to a fixed range before converting it to a score?"',
		'- "How does the logarithmic scaling affect the relationship between small and large input values?"',
		'- "What would happen if the conditional check were removed and the code always executed the next block?"',
		'- "Why does the loop need to process each item individually instead of operating on the entire collection at once?"',
		'',
		'BAD question examples (too vague):',
		'- "What is the purpose of this code?" (could apply to anything)',
		'- "What core purpose does this block serve in the larger flow?" (not anchored to the snippet)',
		'- "How does this code work?" (too broad)',
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
		'The following output was supposed to be a code comprehension question but is malformed.',
		'Rewrite it into exactly one clear, specific question about the behavior of the selected code snippet.',
		'',
		'STRICT RULES:',
		'- Output exactly one question ending with a question mark.',
		'- The question must reference a specific operation or behavior in the snippet (e.g., a calculation, a conditional check, a transformation).',
		'- Do NOT produce a generic question like "What does this code do?".',
		'- No preface, no labels, no markdown, and no code.',
		'- Keep it to 1-2 short sentences.',
		'- Do not provide the answer.',
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
		'You are a code comprehension coach.',
		'Give exactly one sentence as a conceptual nudge to help the learner think in the right direction.',
		'Speak directly to the learner in second person.',
		'',
		'STRICT RULES:',
		'- Do NOT mention any specific variable names, function names, method names, API names, library names, or table names from the code.',
		'- Do NOT describe what the code does or how it works.',
		'- Do NOT give away the answer or any part of the answer.',
		'- Only point toward the general programming concept or pattern the learner should think about.',
		'- If the code contains a recognizable pattern (loop, branch, transformation, clamping, normalization, error recovery), name the general category of that pattern without naming code identifiers.',
		'- Keep the hint tied to the behavior asked in the question, not a generic coding tip.',
		'- Make sure the hint is one complete sentence, not cut off.',
		'',
		'GOOD hint examples:',
		'- "Think about what happens when you need to handle both the case where something already exists and the case where it does not."',
		'- "Consider why limiting a value to a fixed range prevents extreme inputs from distorting the overall score."',
		'- "Track what changes on each iteration and why repeating that step matters for the final outcome."',
		'- "Focus on the condition that decides when the logic takes one path instead of another."',
		'',
		'BAD hint examples:',
		'- "The prisma.users.upsert method finds or creates a user record." (gives away the answer)',
		'- "Look at the code carefully." (too vague, not a useful nudge)',
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
		'Explain what this specific code does to answer the question.',
		'',
		'REQUIREMENTS:',
		'- Reference at least one concrete operation from the code (for example: "calls Math.log2 to normalize", "iterates with .map to transform each item", "checks if the value is null before proceeding").',
		'- The explanation must be specific enough that someone who has not seen the code still understands exactly what it is doing.',
		'- Never give a generic answer that could apply to many code snippets; always anchor your explanation to this code.',
		'- If the code is complex, focus your explanation on the single most important thing it does that answers the question.',
		'- If the question asks about a specific behavior (update, validation, branching, loop purpose, clamping), keep the explanation centered on that behavior.',
		'',
		'FORMAT RULES:',
		'- Never reference, quote, or repeat the learner answer.',
		'- Write as a senior developer teaching a junior: direct, plain English, minimal jargon.',
		'- Use a maximum of 3 sentences.',
		'- Do not restate the question.',
		'- Do not start with "The purpose of".',
		'- Do not output labels like [PASS], [PARTIAL], or [MISS].',
		'',
		'GOOD explanation example:',
		'"The function clamps the percentage slope to a ±5 range using Math.max and Math.min, then shifts and scales that clamped value into a 0–100 score. This prevents extreme outlier slopes from dominating the final health calculation."',
		'',
		'BAD explanation example:',
		'"The code performs a sequence of checks and operations to transform input into a reliable result." (too generic — could describe any code)',
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
		'Reference at least one concrete operation from the code flow, such as a function call, a calculation, a loop transformation, or a conditional check.',
		'Make it specific enough that someone who has not seen the code can still understand exactly what happens.',
		'Never output a generic explanation that could apply to unrelated code.',
		'Never reference, quote, or repeat any learner answer.',
		'Use plain English and keep jargon minimal.',
		'Use a maximum of 3 sentences.',
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

function buildAvoidQuestionLines(avoidQuestions: string[]): string[] {
	const cleaned = avoidQuestions
		.map((question) => question.trim())
		.filter((question) => question.length > 0)
		.slice(-6);

	if (cleaned.length === 0) {
		return [];
	}

	return [
		'Avoid repeating any of these existing questions:',
		...cleaned.map((question) => `- ${question}`)
	];
}
