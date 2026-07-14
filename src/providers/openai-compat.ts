import * as vscode from 'vscode';
import { LLMProvider, LLMRequestOptions } from './types';

export class OpenAICompatibleProvider implements LLMProvider {
	readonly name = 'openai-compatible';
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	private getConfiguredBaseUrl(): string {
		const configured = vscode.workspace.getConfiguration('intellegode').get<string>('apiBaseUrl');
		const normalized = (configured ?? '').trim().replace(/\/+$/, '');
		if (!normalized) {
			throw new Error('Missing configuration: intellegode.apiBaseUrl');
		}
		return normalized;
	}

	private getConfiguredModel(): string {
		const configured = vscode.workspace.getConfiguration('intellegode').get<string>('defaultModel');
		const normalized = (configured ?? '').trim();
		if (!normalized) {
			throw new Error('Missing configuration: intellegode.defaultModel');
		}
		return normalized;
	}

	private async getApiKey(): Promise<string> {
		const key = await this.context.secrets.get('intellegode.apiKey');
		if (!key) {
			throw new Error('API key not set. Please run the "Intellegode: Set API Key" command.');
		}
		return key;
	}

	async checkAvailability(): Promise<{ available: boolean; message?: string }> {
		try {
			const key = await this.context.secrets.get('intellegode.apiKey');
			if (!key) {
				return { available: false, message: 'API key not configured. Run "Intellegode: Set API Key".' };
			}
			// Just a simple check if the URL is valid, we can't reliably ping all OpenAI compatible endpoints without a valid payload
			this.getConfiguredBaseUrl();
			return { available: true };
		} catch (error) {
			return { available: false, message: error instanceof Error ? error.message : 'Unknown error checking availability.' };
		}
	}

	async sendPrompt(prompt: string, options?: LLMRequestOptions): Promise<string> {
		const baseUrl = this.getConfiguredBaseUrl();
		const apiKey = await this.getApiKey();
		const model = options?.model?.trim() ? options.model : this.getConfiguredModel();
		const timeoutMs = options?.timeoutMs ?? 45000;
		const maxTokens = options?.maxTokens ?? 300;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(`${baseUrl}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				signal: controller.signal,
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: 'You are a fast API. Do not output thinking processes or internal monologues. Provide only the final answer.' },
						{ role: 'user', content: prompt }
					],
					temperature: 0.2,
					max_tokens: maxTokens,
					stream: false
				})
			});

			if (!response.ok) {
				let detail = '';
				try {
					detail = await response.text();
				} catch {
					// ignore
				}
				throw new Error(`API returned ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
			}

			const data = await response.json() as any;
			if (!data.choices || !data.choices[0] || !data.choices[0].message) {
				throw new Error('Invalid response format from API');
			}

			return data.choices[0].message.content.trim();
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`API request timed out after ${timeoutMs}ms for model '${model}'.`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
