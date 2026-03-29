import * as assert from 'assert';
import {
	evaluateAnswer,
	isContextuallyRelevant,
	isValidEvaluationOutput,
	normalizeEvaluationOutput
} from '../quizService';

suite('Quiz Service', () => {
	test('normalizeEvaluationOutput maps legacy emoji labels', () => {
		const normalized = normalizeEvaluationOutput('✅ Got it You are right because this protects access.');
		assert.strictEqual(normalized, '[PASS] You are right because this protects access.');
	});

	test('isValidEvaluationOutput rejects label-only output', () => {
		assert.strictEqual(isValidEvaluationOutput('[PASS]'), false);
		assert.strictEqual(isValidEvaluationOutput('[MISS] nope'), false);
	});

	test('evaluateAnswer retries once for malformed output', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return '[PASS]';
			}
			return '[PASS] You identified the key concept because you explained the permission check for access control.';
		};

		const result = await evaluateAnswer(
			'code',
			'What is the purpose of this permission check?',
			'It is a permission check for access control.',
			'qwen3:4b',
			fakeCaller
		);
		assert.ok(result.startsWith('[PASS]'));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer retries when first response is unrelated to question', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return '[PASS] You recognized this is a permission check because it limits who can execute this step.';
			}
			return '[PASS] You described the velocity score because you explained how slope and volume are blended.';
		};

		const question = 'How is velocityScore calculated?';
		const answer = 'It blends slope, volume, and recency.';
		const result = await evaluateAnswer('code', question, answer, 'qwen3:4b', fakeCaller);
		assert.ok(result.includes('velocity'));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer returns safe fallback when malformed twice', async () => {
		const fakeCaller = async (): Promise<string> => '[PARTIAL]';
		const result = await evaluateAnswer('code', 'question', 'answer', 'qwen3:4b', fakeCaller);
		assert.ok(result.startsWith('[PARTIAL]'));
		assert.ok(result.includes('because'));
	});

	test('isContextuallyRelevant requires at least one key-term overlap', () => {
		const relevant = isContextuallyRelevant(
			'[PASS] You explained velocity because you described how slope and volume are combined.',
			'How is velocityScore calculated?',
			'It blends slope and volume.'
		);
		const unrelated = isContextuallyRelevant(
			'[PASS] You identified a permission check because this controls access.',
			'How is velocityScore calculated?',
			'It blends slope and volume.'
		);

		assert.strictEqual(relevant, true);
		assert.strictEqual(unrelated, false);
	});
});
