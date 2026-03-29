import { callOllama } from './ollamaClient';
import { buildEvaluatePrompt, buildHintPrompt, buildQuizQuestionPrompt } from './prompts';

export async function generateQuizQuestion(selectedCode: string): Promise<string> {
	const result = await callOllama(buildQuizQuestionPrompt(selectedCode));
	return result || 'No question was generated.';
}

export async function generateHint(code: string, question: string): Promise<string> {
	const result = await callOllama(buildHintPrompt(code, question));
	return result || 'No hint was generated.';
}

export async function evaluateAnswer(code: string, question: string, answer: string): Promise<string> {
	const result = await callOllama(buildEvaluatePrompt(code, question, answer));
	return result || 'No evaluation was generated.';
}
