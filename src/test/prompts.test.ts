import * as assert from 'assert';
import { buildEvaluatePrompt, buildHintPrompt, buildQuizQuestionPrompt } from '../prompts';

suite('Prompt Builders', () => {
	test('buildQuizQuestionPrompt enforces beginner single-concept question', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;');
		assert.ok(prompt.includes('beginner-friendly comprehension question'));
		assert.ok(prompt.includes('single concept only'));
		assert.ok(prompt.includes('No multi-part questions.'));
	});

	test('buildHintPrompt enforces conceptual-only hint', () => {
		const prompt = buildHintPrompt('function a() {}', 'What does this do?');
		assert.ok(prompt.includes('conceptual nudge'));
		assert.ok(prompt.includes('Do not mention specific variable names'));
		assert.ok(prompt.includes('without giving away the answer'));
	});

	test('buildEvaluatePrompt includes explicit label guidance', () => {
		const prompt = buildEvaluatePrompt('code', 'question', 'answer');
		assert.ok(prompt.includes('"[PASS]"'));
		assert.ok(prompt.includes('"[PARTIAL]"'));
		assert.ok(prompt.includes('"[MISS]"'));
		assert.ok(prompt.includes('Returning only [PASS], [PARTIAL], or [MISS] with no explanation is not allowed.'));
		assert.ok(prompt.includes('compare the learner answer against the actual code provided'));
		assert.ok(prompt.includes('If the user\'s answer contains the correct function name or key term and a reasonable description, always return [PASS].'));
		assert.ok(prompt.includes('never use generic advice like "try again" or "refine your explanation"'));
		assert.ok(prompt.includes('Feedback must stay aligned to this specific code and question context.'));
		assert.ok(prompt.includes('Do not introduce unrelated domains or canned phrases not grounded in this code/question/answer.'));
	});
});
