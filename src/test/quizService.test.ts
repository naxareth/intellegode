import * as assert from 'assert';
import {
	evaluateAnswer,
	generateQuizQuestion,
	isContextuallyRelevant,
	isValidExplanationOutput,
	normalizeExplanationOutput,
	normalizeHintOutput,
	normalizeQuizQuestionOutput
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
		assert.strictEqual(isValidExplanationOutput('The condition that decides which branch of logic runs.'), false);
	});

	test('normalizeHintOutput compresses noisy multi-part hint into one conceptual sentence', () => {
		const raw = 'In the provided code, think about which checks must pass before any action continues. 1. **Condition A**: The code checks if (skill.health_score >= 70). 2. **Condition B**: It also checks marketData.';
		const normalized = normalizeHintOutput(raw);
		assert.strictEqual(normalized, 'think about which checks must pass before any action continues.');
	});

	test('normalizeHintOutput keeps longer single-sentence hints without aggressive truncation', () => {
		const raw = 'Focus on how data is validated before processing begins, then notice how each step builds on the previous one so the logic can safely continue through the workflow without breaking later operations.';
		const normalized = normalizeHintOutput(raw);
		assert.strictEqual(normalized, raw);
	});

	test('normalizeQuizQuestionOutput extracts a clean question from malformed output', () => {
		const raw = "Certainly! Below is the complete function: import genAI from 'genAI'; What decides whether a user is created or updated?";
		const normalized = normalizeQuizQuestionOutput(raw);
		assert.strictEqual(normalized, 'What decides whether a user is created or updated?');
	});

	test('generateQuizQuestion retries with repair prompt when first output is malformed', async () => {
		const calls: string[] = [];
		const fakeCaller = async (prompt: string): Promise<string> => {
			calls.push(prompt);
			if (calls.length === 1) {
				return "Certainly! Here is the code: import x from 'y';";
			}
			return 'What condition controls whether this block returns early?';
		};

		const question = await generateQuizQuestion('if (!user) return;', 'if (!user) return;', fakeCaller);
		assert.strictEqual(question, 'What condition controls whether this block returns early?');
		assert.strictEqual(calls.length, 2);
	});

	test('generateQuizQuestion avoids repeating recent questions', async () => {
		const repeated = 'What condition decides which branch of logic runs in this code?';
		const fakeCaller = async (): Promise<string> => repeated;

		const question = await generateQuizQuestion(
			'if (isReady) { runTask(); } else { scheduleRetry(); }',
			'if (isReady) { runTask(); } else { scheduleRetry(); }',
			fakeCaller,
			[repeated]
		);

		assert.notStrictEqual(question, repeated);
		assert.ok(question.endsWith('?'));
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
			'qwen3.5:4b',
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
		const result = await evaluateAnswer('code', question, answer, 'qwen3.5:4b', fakeCaller);
		assert.ok(/velocity/i.test(result));
		assert.strictEqual(calls.length, 2);
	});

	test('evaluateAnswer returns safe fallback when malformed twice', async () => {
		const fakeCaller = async (): Promise<string> => 'Nope.';
		const result = await evaluateAnswer(
			'code',
			'What does prisma.users.upsert do in this code?',
			'It creates a user if no matching wallet exists, otherwise it updates the existing one.',
			'qwen3.5:4b',
			fakeCaller
		);
		assert.ok(result.includes('updates an existing stored value'));
		assert.ok(result.includes('outdated information'));
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

		const result = await evaluateAnswer('code', 'How is velocityScore calculated?', 'It blends slope and volume.', 'qwen3.5:4b', fakeCaller);
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
			'This validator normalizes input values before validating each field.',
				'How does this validation flow work?'
		);

		assert.strictEqual(result, true);
	});
});
