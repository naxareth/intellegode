export type OllamaGenerateResponse = {
	response?: string;
	error?: string;
};

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type OllamaChatResponse = {
	message?: {
		content?: string;
	};
	error?: string;
};

export type QuizWebviewMessage =
	| { command: 'submitAnswer'; answer?: string }
	| { command: 'requestHint' }
	| { command: 'newQuestion'; difficulty?: QuizDifficulty }
	| { command: 'resetQuiz' }
	| { command: 'selfGrade'; result?: 'got-it' | 'missed-it' };

export type ConceptTag =
	| 'conditionals'
	| 'loops'
	| 'transformations'
	| 'async-await'
	| 'error-handling'
	| 'return-contracts'
	| 'fallback-defaults'
	| 'general';

export type QuizRecord = {
	id: string;
	question: string;
	userAnswer: string;
	explanation: string;
	selfGrade: 'got-it' | 'missed-it';
	conceptTags: ConceptTag[];
	languageId: string;
	codeSnippetPreview: string;
	timestamp: number;
};

export type ConceptStats = {
	concept: ConceptTag;
	total: number;
	gotIt: number;
	missedIt: number;
	missRate: number;
	lastReviewedAt: number;
};

export type StreakData = {
	currentStreak: number;
	longestStreak: number;
	lastActiveDate: string;
	totalSessions: number;
	totalQuestions: number;
};
