import * as assert from 'assert';
import { buildEvaluatePrompt, buildHintPrompt, buildQuizQuestionPrompt } from '../prompts';

suite('Prompt Builders', () => {
	test('buildQuizQuestionPrompt enforces beginner single-concept question', () => {
		const prompt = buildQuizQuestionPrompt('const x = 1;', 'const x = 1;\nconsole.log(x);');
		assert.ok(prompt.includes('code comprehension coach helping a developer truly understand their own code'));
		assert.ok(prompt.includes('single most important concrete operation'));
		assert.ok(prompt.includes('MUST reference a specific behavior visible in the snippet'));
		assert.ok(prompt.includes('Do NOT ask "What is the purpose of this code?"'));
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
		assert.ok(prompt.includes('If the code contains a recognizable pattern'));
		assert.ok(prompt.includes('GOOD hint examples:'));
		assert.ok(prompt.includes('Keep the hint tied to the behavior asked in the question'));
		assert.ok(prompt.includes('general programming concept'));
	});

	test('buildEvaluatePrompt requests explanation-only output', () => {
		const prompt = buildEvaluatePrompt('code', 'question');
		assert.ok(prompt.includes('Reference at least one concrete operation from the code'));
		assert.ok(prompt.includes('Never give a generic answer that could apply to many code snippets'));
		assert.ok(prompt.includes('focus your explanation on the single most important thing it does'));
		assert.ok(prompt.includes('keep the explanation centered on that behavior'));
		assert.ok(prompt.includes('Never reference, quote, or repeat the learner answer.'));
		assert.ok(prompt.includes('Use a maximum of 3 sentences.'));
		assert.ok(prompt.includes('Do not restate the question.'));
		assert.ok(prompt.includes('Correct explanation:'));
	});
});
