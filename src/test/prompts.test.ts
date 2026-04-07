import * as assert from 'assert';
import { buildEvaluatePrompt, buildHintPrompt, buildQuizQuestionPrompt } from '../prompts';

suite('Prompt Builders', () => {
	test('buildQuizQuestionPrompt enforces beginner single-concept question', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;\nconsole.log(x);');
		assert.ok(prompt.includes("You are a strict but fair Senior Staff Software Engineer reviewing a Junior Developer's Pull Request."));
		assert.ok(prompt.includes('Write one code-comprehension question about the selected snippet.'));
		assert.ok(prompt.includes('STRICT RULES:'));
		assert.ok(prompt.includes('- Output ONLY one question and nothing else.'));
		assert.ok(prompt.includes('- The question must end with a question mark.'));
		assert.ok(prompt.includes('- Mention one exact identifier from the snippet'));
		assert.ok(prompt.includes('- Focus on behavior, purpose, control flow, or consequence within this snippet.'));
		assert.ok(prompt.includes("- Do NOT ask basic syntax or definition questions (e.g., 'What does the || operator do?')."));
		assert.ok(prompt.includes('- Ask about a potential edge case, an unhandled error, a state mutation, or a design tradeoff.'));
		assert.ok(prompt.includes('- Force the developer to defend their architectural choices or explain what happens when assumptions fail.'));
		assert.ok(prompt.includes('BAD examples (do not generate these):'));
		assert.ok(prompt.includes('- What does this function do? (too broad)'));
		assert.ok(prompt.includes('- What language feature is used here? (syntax question, not comprehension)'));
	});

	test('buildQuizQuestionPrompt includes anti-repeat list when provided', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;', [
			'What condition decides which branch runs?',
			'What is the loop doing each iteration?'
		]);
		assert.ok(prompt.includes('You have already asked questions about this code. Focus on a DIFFERENT behavior, condition, or operation than the ones listed below. Look at a different part of the snippet.'));
		assert.ok(prompt.includes('Avoid repeating any of these existing questions:'));
		assert.ok(prompt.includes('- What condition decides which branch runs?'));
		assert.ok(prompt.includes('- What is the loop doing each iteration?'));
	});

	test('buildQuizQuestionPrompt adds urgent anti-repeat instruction with 3+ prior questions', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;', [
			'Question one?',
			'Question two?',
			'Question three?'
		]);
		assert.ok(prompt.includes('IMPORTANT: The questions listed above have already been asked. You MUST generate a completely different question focusing on a different part of the code or a different behavior.'));
	});

	test('buildHintPrompt enforces conceptual-only hint', () => {
		const prompt = buildHintPrompt('function a() {}', 'What does this do?');
		assert.ok(prompt.includes('Write one conceptual fill-in-the-blank hint for the learner.'));
		assert.ok(prompt.includes('- Output exactly one sentence ending with a period.'));
		assert.ok(prompt.includes('- Use this structure: "Focus on how ____ affects ____ before ____."'));
		assert.ok(prompt.includes('- Keep the blanks behavior-focused and concept-level'));
	});

	test('buildEvaluatePrompt requests explanation-only output', () => {
		const prompt = buildEvaluatePrompt('code', 'question');
		assert.ok(prompt.includes("Evaluate the Junior Developer's answer like a Senior Staff Engineer."));
		assert.ok(prompt.includes('- Use plain English in 1 to 3 sentences.'));
		assert.ok(prompt.includes('- Mention at least one exact identifier from the code.'));
		assert.ok(prompt.includes("- Briefly validate what they got right, but explicitly point out the deeper architectural 'why' or edge case they missed."));
		assert.ok(prompt.includes('- Do not output labels, grading, or the learner answer.'));
		assert.ok(prompt.includes('Correct explanation:'));
	});
});
