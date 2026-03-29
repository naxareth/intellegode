import * as assert from 'assert';
import { evaluateAnswer, isValidEvaluationOutput, normalizeEvaluationOutput } from '../quizService';

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
			return '[PASS] You identified the key concept because you explained the purpose of access control.';
		};

		const result = await evaluateAnswer('code', 'question', 'answer', fakeCaller);
		assert.ok(result.startsWith('[PASS]'));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer returns safe fallback when malformed twice', async () => {
		const fakeCaller = async (): Promise<string> => '[PARTIAL]';
		const result = await evaluateAnswer('code', 'question', 'answer', fakeCaller);
		assert.ok(result.startsWith('[PARTIAL]'));
		assert.ok(result.includes('because'));
	});
});
