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

	test('buildEvaluatePrompt requests explanation-only output', () => {
		const prompt = buildEvaluatePrompt('code', 'question');
		assert.ok(prompt.includes('Reference the actual operations in the code'));
		assert.ok(prompt.includes('Never give a generic answer that could apply to many code snippets'));
		assert.ok(prompt.includes('Never reference, quote, or repeat the learner answer.'));
		assert.ok(prompt.includes('Use a maximum of 2 sentences.'));
		assert.ok(prompt.includes('Do not restate the question.'));
		assert.ok(prompt.includes('Correct explanation:'));
	});
});
