export type OllamaGenerateResponse = {
	response?: string;
	error?: string;
};

export type QuizWebviewMessage =
	| { command: 'submitAnswer'; answer?: string }
	| { command: 'requestHint' }
	| { command: 'newQuestion' }
	| { command: 'resetQuiz' }
	| { command: 'selfGrade'; result?: 'got-it' | 'missed-it' };
