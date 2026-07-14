import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	generateRecordId,
	saveQuizRecord,
	getQuizHistory,
	getConceptStats,
	getStreakData,
	updateStreakData,
	clearQuizHistory
} from '../quizHistory';
import { QuizRecord, StreakData } from '../types';

function createMockContext(): { globalState: { get: Function; update: Function } } {
	const store: Record<string, unknown> = {};
	return {
		globalState: {
			get: (key: string, defaultValue: unknown) => store[key] ?? defaultValue,
			update: async (key: string, value: unknown) => {
				store[key] = value;
			}
		}
	};
}

suite('Quiz History & Storage', () => {
	let mockContext: vscode.ExtensionContext;

	setup(() => {
		mockContext = createMockContext() as unknown as vscode.ExtensionContext;
	});

	test('generateRecordId returns unique string', () => {
		const id1 = generateRecordId();
		const id2 = generateRecordId();
		assert.notStrictEqual(id1, id2);
		assert.ok(typeof id1 === 'string');
		assert.ok(id1.length > 0);
	});

	test('saveQuizRecord creates valid record and updates history', async () => {
		const partialRecord = {
			question: 'What is x?',
			userAnswer: 'It is 5',
			explanation: 'Correct',
			selfGrade: 'got-it' as const,
			conceptTags: ['general' as const],
			languageId: 'typescript',
			codeSnippetPreview: 'const x = 5;'
		};

		const record = await saveQuizRecord(mockContext, partialRecord);

		assert.ok(record.id);
		assert.ok(record.timestamp);
		assert.strictEqual(record.question, 'What is x?');

		const history = getQuizHistory(mockContext);
		assert.strictEqual(history.length, 1);
		assert.strictEqual(history[0].id, record.id);
	});

	test('getQuizHistory returns empty array when no data exists', () => {
		const history = getQuizHistory(mockContext);
		assert.deepStrictEqual(history, []);
	});

	test('getConceptStats correctly aggregates miss rates', async () => {
		await saveQuizRecord(mockContext, {
			question: 'Q1',
			userAnswer: 'A1',
			explanation: 'E1',
			selfGrade: 'got-it',
			conceptTags: ['error-handling'],
			languageId: 'typescript',
			codeSnippetPreview: 'try{}catch(e){}'
		});

		await saveQuizRecord(mockContext, {
			question: 'Q2',
			userAnswer: 'A2',
			explanation: 'E2',
			selfGrade: 'missed-it',
			conceptTags: ['error-handling'],
			languageId: 'typescript',
			codeSnippetPreview: 'try{}catch(e){}'
		});

		await saveQuizRecord(mockContext, {
			question: 'Q3',
			userAnswer: 'A3',
			explanation: 'E3',
			selfGrade: 'missed-it',
			conceptTags: ['loops'],
			languageId: 'typescript',
			codeSnippetPreview: 'for(;;){}'
		});

		const stats = getConceptStats(mockContext);
		
		// Expected: loops (missRate: 1.0), error-handling (missRate: 0.5)
		assert.strictEqual(stats.length, 2);
		assert.strictEqual(stats[0].concept, 'loops');
		assert.strictEqual(stats[0].missRate, 1.0);
		
		assert.strictEqual(stats[1].concept, 'error-handling');
		assert.strictEqual(stats[1].missRate, 0.5);
		assert.strictEqual(stats[1].total, 2);
		assert.strictEqual(stats[1].gotIt, 1);
		assert.strictEqual(stats[1].missedIt, 1);
	});

	test('updateStreakData increments streak for consecutive days', async () => {
		const todayStr = new Date().toISOString().split('T')[0];
		
		// Mock lastActiveDate as yesterday
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];
		
		await mockContext.globalState.update('intellegode.streakData', {
			currentStreak: 2,
			longestStreak: 2,
			lastActiveDate: yesterdayStr,
			totalSessions: 2,
			totalQuestions: 5
		});

		const streak = await updateStreakData(mockContext);
		assert.strictEqual(streak.currentStreak, 3);
		assert.strictEqual(streak.longestStreak, 3);
		assert.strictEqual(streak.totalSessions, 3);
		assert.strictEqual(streak.totalQuestions, 6);
		assert.strictEqual(streak.lastActiveDate, todayStr);
	});

	test('updateStreakData resets streak when there is a gap', async () => {
		const todayStr = new Date().toISOString().split('T')[0];
		
		// Mock lastActiveDate as 3 days ago
		const pastDate = new Date();
		pastDate.setDate(pastDate.getDate() - 3);
		const pastDateStr = pastDate.toISOString().split('T')[0];
		
		await mockContext.globalState.update('intellegode.streakData', {
			currentStreak: 5,
			longestStreak: 5,
			lastActiveDate: pastDateStr,
			totalSessions: 10,
			totalQuestions: 20
		});

		const streak = await updateStreakData(mockContext);
		assert.strictEqual(streak.currentStreak, 1);
		assert.strictEqual(streak.longestStreak, 5); // Should remain 5
		assert.strictEqual(streak.totalSessions, 11);
		assert.strictEqual(streak.totalQuestions, 21);
		assert.strictEqual(streak.lastActiveDate, todayStr);
	});

	test('clearQuizHistory resets all data', async () => {
		await saveQuizRecord(mockContext, {
			question: 'Q', userAnswer: 'A', explanation: 'E',
			selfGrade: 'got-it', conceptTags: ['general'], languageId: 'ts', codeSnippetPreview: 'code'
		});
		
		let history = getQuizHistory(mockContext);
		assert.strictEqual(history.length, 1);
		
		await clearQuizHistory(mockContext);
		
		history = getQuizHistory(mockContext);
		assert.strictEqual(history.length, 0);
		
		const streak = getStreakData(mockContext);
		assert.strictEqual(streak.currentStreak, 0);
	});

	test('history is capped at MAX_HISTORY_RECORDS (200)', async () => {
		// Mock 200 records
		const manyRecords: QuizRecord[] = Array.from({ length: 200 }, (_, i) => ({
			id: `id-${i}`,
			question: `Q${i}`,
			userAnswer: `A${i}`,
			explanation: `E${i}`,
			selfGrade: 'got-it',
			conceptTags: ['general'],
			languageId: 'typescript',
			codeSnippetPreview: 'code',
			timestamp: Date.now()
		}));
		
		await mockContext.globalState.update('intellegode.quizHistory', manyRecords);
		
		// Add one more
		await saveQuizRecord(mockContext, {
			question: 'New Question',
			userAnswer: 'New Answer',
			explanation: 'E',
			selfGrade: 'missed-it',
			conceptTags: ['general'],
			languageId: 'typescript',
			codeSnippetPreview: 'code'
		});
		
		const history = getQuizHistory(mockContext);
		assert.strictEqual(history.length, 200);
		assert.strictEqual(history[history.length - 1].question, 'New Question');
		assert.notStrictEqual(history[0].id, 'id-0'); // The first one should have been shifted out
	});
});
