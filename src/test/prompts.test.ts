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
		const prompt = buildEvaluatePrompt('code', 'question', 'answer');
		assert.ok(prompt.includes('Do not grade the user answer'));
		assert.ok(prompt.includes('Write exactly 2 concise sentences.'));
		assert.ok(prompt.includes('Avoid unrelated domains'));
		assert.ok(prompt.includes('Correct explanation:'));
	});
});
