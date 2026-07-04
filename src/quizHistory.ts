import * as vscode from 'vscode';
import { QuizRecord, ConceptStats, ConceptTag, StreakData } from './types';

const HISTORY_STATE_KEY = 'intellegode.quizHistory';
const STREAK_STATE_KEY = 'intellegode.streakData';
const MAX_HISTORY_RECORDS = 200;

export function generateRecordId(): string {
	return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

export async function saveQuizRecord(
	context: vscode.ExtensionContext,
	record: Omit<QuizRecord, 'id' | 'timestamp'>
): Promise<QuizRecord> {
	const newRecord: QuizRecord = {
		...record,
		id: generateRecordId(),
		timestamp: Date.now()
	};

	const history = context.globalState.get<QuizRecord[]>(HISTORY_STATE_KEY, []);
	history.push(newRecord);

	if (history.length > MAX_HISTORY_RECORDS) {
		history.splice(0, history.length - MAX_HISTORY_RECORDS);
	}

	await context.globalState.update(HISTORY_STATE_KEY, history);
	await updateStreakData(context);

	return newRecord;
}

export function getQuizHistory(context: vscode.ExtensionContext): QuizRecord[] {
	const history = context.globalState.get<QuizRecord[]>(HISTORY_STATE_KEY, []);
	return history.filter(
		(record) =>
			record &&
			typeof record === 'object' &&
			typeof record.id === 'string' &&
			typeof record.question === 'string' &&
			(record.selfGrade === 'got-it' || record.selfGrade === 'missed-it')
	);
}

export function getConceptStats(context: vscode.ExtensionContext): ConceptStats[] {
	const history = getQuizHistory(context);
	const statsMap = new Map<ConceptTag, ConceptStats>();

	for (const record of history) {
		for (const tag of record.conceptTags) {
			let stat = statsMap.get(tag);
			if (!stat) {
				stat = {
					concept: tag,
					total: 0,
					gotIt: 0,
					missedIt: 0,
					missRate: 0,
					lastReviewedAt: 0
				};
				statsMap.set(tag, stat);
			}

			stat.total += 1;
			if (record.selfGrade === 'got-it') {
				stat.gotIt += 1;
			} else if (record.selfGrade === 'missed-it') {
				stat.missedIt += 1;
			}

			if (record.timestamp > stat.lastReviewedAt) {
				stat.lastReviewedAt = record.timestamp;
			}
		}
	}

	const statsArray = Array.from(statsMap.values());
	for (const stat of statsArray) {
		stat.missRate = stat.total > 0 ? stat.missedIt / stat.total : 0;
	}

	statsArray.sort((a, b) => b.missRate - a.missRate);
	return statsArray;
}

export function getStreakData(context: vscode.ExtensionContext): StreakData {
	const defaultStreak: StreakData = {
		currentStreak: 0,
		longestStreak: 0,
		lastActiveDate: '',
		totalSessions: 0,
		totalQuestions: 0
	};
	return context.globalState.get<StreakData>(STREAK_STATE_KEY, defaultStreak);
}

export async function updateStreakData(context: vscode.ExtensionContext): Promise<StreakData> {
	const streakData = getStreakData(context);
	const today = new Date().toISOString().split('T')[0];

	if (streakData.lastActiveDate === today) {
		streakData.totalQuestions += 1;
	} else {
		let isYesterday = false;
		if (streakData.lastActiveDate) {
			const lastDate = new Date(streakData.lastActiveDate);
			const todayDate = new Date(today);
			const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			isYesterday = diffDays === 1;
		}

		if (isYesterday) {
			streakData.currentStreak += 1;
		} else {
			streakData.currentStreak = 1;
		}

		streakData.totalSessions += 1;
		streakData.totalQuestions += 1;
		streakData.lastActiveDate = today;

		if (streakData.currentStreak > streakData.longestStreak) {
			streakData.longestStreak = streakData.currentStreak;
		}
	}

	await context.globalState.update(STREAK_STATE_KEY, streakData);
	return streakData;
}

export async function clearQuizHistory(context: vscode.ExtensionContext): Promise<void> {
	await context.globalState.update(HISTORY_STATE_KEY, undefined);
	await context.globalState.update(STREAK_STATE_KEY, undefined);
}

export function getWeakConceptNudge(context: vscode.ExtensionContext): string | null {
	const stats = getConceptStats(context);
	const now = Date.now();
	const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

	const weakConcepts = stats.filter(stat => 
		stat.missRate > 0.5 && 
		stat.total >= 2 && 
		(stat.lastReviewedAt === 0 || now - stat.lastReviewedAt > THREE_DAYS_MS)
	);

	if (weakConcepts.length === 0) {
		return null;
	}

	const topWeakness = weakConcepts[0].concept;
	const formattedConcept = topWeakness === 'async-await' ? 'async/await' : topWeakness.replace(/-/g, ' ');

	return `You've struggled with ${formattedConcept} recently. Try selecting code related to it to practice.`;
}
