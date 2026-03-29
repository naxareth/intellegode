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
		'Accept answers that are correct in meaning even if wording is different from ideal phrasing.',
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
		'6) For "[PARTIAL]", provide exactly two sentences: one sentence on what they got right, plus one sentence hint on what they missed.',
		'7) For "[MISS]", provide exactly one sentence nudge in the right direction.',
		'8) Keep feedback concise, maximum 2 sentences total.',
		'9) Never reveal the full answer or implementation details.',
		'10) Do not mention specific variable names, function names, or code identifiers unless already present in the learner answer.',
		'Example formats:',
		'"[PASS] You identified the core idea because this check enforces access control for sensitive actions."',
		'"[PARTIAL] You recognized this is a permission check because it limits who can act. You may want to think more about which security risk it prevents."',
		'"[MISS] You may be focusing on the wrong detail, so think about why restricting who can execute this step protects the system."',
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

export function buildEvaluationRepairPrompt(rawOutput: string): string {
	return [
		'Rewrite the feedback into the exact required format.',
		'Required format: [PASS] or [PARTIAL] or [MISS], followed by explanatory text on the same line.',
		'Never return only the label.',
		'Speak in second person ("You ...").',
		'Keep feedback concise, maximum 2 sentences.',
		'Never reveal implementation details or full solution.',
		'',
		'Original feedback:',
		rawOutput
	].join('\n');
}
