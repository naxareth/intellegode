export type OllamaGenerateResponse = {
	response?: string;
	error?: string;
};

export type OllamaChatResponse = {
	message?: {
		content?: string;
	};
	error?: string;
};

export type QuizWebviewMessage =
	| { command: 'submitAnswer'; answer?: string }
	| { command: 'requestHint' }
	| { command: 'newQuestion' }
	| { command: 'resetQuiz' }
	| { command: 'selfGrade'; result?: 'got-it' | 'missed-it' };
