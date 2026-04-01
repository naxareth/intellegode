import * as assert from 'assert';
import { buildEvaluatePrompt, buildHintPrompt, buildQuizQuestionPrompt } from '../prompts';

suite('Prompt Builders', () => {
	test('buildQuizQuestionPrompt enforces beginner single-concept question', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;\nconsole.log(x);');
		assert.ok(prompt.includes('beginner-friendly comprehension question'));
		assert.ok(prompt.includes('single concept only'));
		assert.ok(prompt.includes('Ask about the purpose or behavior of the code'));
		assert.ok(prompt.includes('Anchor the question to concrete behavior from the selected snippet'));
		assert.ok(prompt.includes('No multi-part questions.'));
	});

	test('buildQuizQuestionPrompt includes anti-repeat list when provided', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;', [
			'What condition decides which branch runs?',
			'What is the loop doing each iteration?'
		]);
		assert.ok(prompt.includes('Avoid repeating any of these existing questions:'));
		assert.ok(prompt.includes('- What condition decides which branch runs?'));
		assert.ok(prompt.includes('- What is the loop doing each iteration?'));
	});

	test('buildHintPrompt enforces conceptual-only hint', () => {
		const prompt = buildHintPrompt('function a() {}', 'What does this do?');
		assert.ok(prompt.includes('conceptual nudge'));
		assert.ok(prompt.includes('Do NOT mention any specific variable names'));
		assert.ok(prompt.includes('Do NOT give away the answer'));
		assert.ok(prompt.includes('GOOD hint example (loops):'));
		assert.ok(prompt.includes('GOOD hint example (conditionals):'));
		assert.ok(prompt.includes('Keep the hint tied to the behavior asked in the question'));
		assert.ok(prompt.includes('general programming concept'));
	});

	test('buildEvaluatePrompt requests explanation-only output', () => {
		const prompt = buildEvaluatePrompt('code', 'question');
		assert.ok(prompt.includes('Reference the actual operations in the code'));
		assert.ok(prompt.includes('Never give a generic answer that could apply to many code snippets'));
		assert.ok(prompt.includes('focus your explanation on the single most important thing it does'));
		assert.ok(prompt.includes('keep the explanation centered on that behavior'));
		assert.ok(prompt.includes('Never reference, quote, or repeat the learner answer.'));
		assert.ok(prompt.includes('Use a maximum of 2 sentences.'));
		assert.ok(prompt.includes('Do not restate the question.'));
		assert.ok(prompt.includes('Correct explanation:'));
	});
});
