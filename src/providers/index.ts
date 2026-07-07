import * as vscode from 'vscode';
import { LLMProvider } from './types';
import { ollamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openai-compat';

export function getProvider(context: vscode.ExtensionContext): LLMProvider {
	const config = vscode.workspace.getConfiguration('intellegode');
	const providerName = config.get<string>('provider') ?? 'ollama';

	if (providerName === 'openai-compatible') {
		return new OpenAICompatibleProvider(context);
	}

	// Default to ollama
	return ollamaProvider;
}
