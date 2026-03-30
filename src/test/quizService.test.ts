import * as assert from 'assert';
import {
	evaluateAnswer,
	isContextuallyRelevant,
	isValidExplanationOutput,
	normalizeExplanationOutput
} from '../quizService';

suite('Quiz Service', () => {
	test('normalizeExplanationOutput flattens lines for valid output', () => {
		const normalized = normalizeExplanationOutput('This check controls access to the action.\nIt prevents unauthorized users from executing the protected logic.');
		assert.strictEqual(
			normalized,
			'This check controls access to the action. It prevents unauthorized users from executing the protected logic.'
		);
	});

	test('isValidExplanationOutput rejects labels and very short text', () => {
		assert.strictEqual(isValidExplanationOutput('[PASS] You are right.'), false);
		assert.strictEqual(isValidExplanationOutput('Too short to be useful.'), false);
	});

	test('evaluateAnswer retries once for malformed output', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return 'Unclear.';
			}
			return 'This check ensures only users with permission can proceed. It protects the guarded behavior from unauthorized access.';
		};

		const result = await evaluateAnswer(
			'code',
			'What is the purpose of this permission check?',
			'It is a permission check for access control.',
			'qwen3:4b',
			fakeCaller
		);
		assert.ok(result.includes('permission'));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer retries when first response is unrelated to question', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return 'This explains the permission gate and access control behavior in this function in enough detail for a valid review output.';
			}
			return 'Velocity score combines slope and volume to estimate momentum. The code blends these signals so recency can influence the final score.';
		};

		const question = 'How is velocityScore calculated?';
		const answer = 'It blends slope, volume, and recency.';
		const result = await evaluateAnswer('code', question, answer, 'qwen3:4b', fakeCaller);
		assert.ok(result.includes('velocity'));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer returns safe fallback when malformed twice', async () => {
		const fakeCaller = async (): Promise<string> => 'Nope.';
		const result = await evaluateAnswer(
			'code',
			'What does prisma.users.upsert do in this code?',
			'It creates a user if no matching wallet exists, otherwise it updates the existing one.',
			'qwen3:4b',
			fakeCaller
		);
		assert.ok(result.includes('This code enforces a specific behavior'));
	});

	test('evaluateAnswer prefers valid repaired output over template fallback', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return 'This function checks API quotas before processing requests. It prevents overuse by enforcing rate limits.';
			}

			return 'The function validates whether an invitation token is still active. It blocks enrollment when the token has expired.';
		};

		const result = await evaluateAnswer('code', 'How is velocityScore calculated?', 'It blends slope and volume.', 'qwen3:4b', fakeCaller);
		assert.ok(result.includes('invitation token'));
		assert.strictEqual(result.includes('Your answer is close to the core idea'), false);
	});

	test('isContextuallyRelevant requires at least one key-term overlap', () => {
		const relevant = isContextuallyRelevant(
			'You explained velocity by describing how slope and volume are combined to produce the final score.',
				'How is velocityScore calculated?'
		);
		const unrelated = isContextuallyRelevant(
			'You identified a permission check because this controls access.',
				'How is velocityScore calculated?'
		);

		assert.strictEqual(relevant, true);
		assert.strictEqual(unrelated, false);
	});

	test('isContextuallyRelevant handles simple word-form differences', () => {
		const result = isContextuallyRelevant(
			'This creates a new user when none exists, otherwise it updates the existing user record.',
				'What does upsert do here?'
		);

		assert.strictEqual(result, true);
	});
});
