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
		'Give exactly one sentence conceptual nudge.',
		'Speak directly to the learner in second person.',
		'Do not mention specific variable names, function names, API names, or implementation details from the code.',
		'Point only toward the underlying concept without giving away the answer.',
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
		'You are a concept-focused code comprehension evaluator.',
		'Evaluate whether the learner demonstrates understanding of the core concept behind the question.',
		'You must compare the learner answer against the actual code provided, not just vague concepts.',
		'Feedback must stay aligned to this specific code and question context.',
		'Accept answers that are correct in meaning even if wording is different from ideal phrasing.',
		'If the learner correctly named the function or concept and gave a reasonable explanation, classify as [PASS] even without perfect wording.',
		'If the user\'s answer contains the correct function name or key term and a reasonable description, always return [PASS].',
		'Use exactly one of these outcomes:',
		'1) "[PASS]" - learner clearly understood the core concept.',
		'2) "[PARTIAL]" - learner got part of it but missed something important.',
		'3) "[MISS]" - learner clearly misunderstood the concept.',
		'Be generous: if the learner shows any real understanding, prefer "[PARTIAL]" over "[MISS]".',
		'Feedback rules (must follow):',
		'1) Output must be on one line: [LABEL] followed immediately by feedback text in second person ("You ...").',
		'2) The label must ALWAYS be followed by feedback text on the same line.',
		'3) Returning only [PASS], [PARTIAL], or [MISS] with no explanation is not allowed.',
		'4) Every response must include a clear reason clause (use "because" or "by") so the learner sees why.',
		'5) For "[PASS]", provide exactly one sentence that states what they got right and why that shows the key concept.',
		'6) For "[PARTIAL]", provide exactly two sentences: one sentence on what they got right, plus one sentence that specifically states what was missing.',
		'7) For "[PARTIAL]", never use generic advice like "try again" or "refine your explanation".',
		'8) For "[MISS]", provide exactly one sentence nudge in the right direction.',
		'9) Keep feedback concise, maximum 2 sentences total.',
		'10) Never reveal the full answer or implementation details.',
		'11) Do not mention specific variable names, function names, or code identifiers unless already present in the learner answer.',
		'12) Do not introduce unrelated domains or canned phrases not grounded in this code/question/answer.',
		'Example formats:',
		'"[PASS] You identified the core idea because your explanation matched the function\'s purpose in this code."',
		'"[PARTIAL] You captured one key part because you described the main direction correctly. You missed the additional component that completes the full logic."',
		'"[MISS] You are focusing on the wrong part, so think about what this function computes step by step."',
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
