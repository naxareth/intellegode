export type LLMRequestOptions = {
	model?: string;
	maxTokens?: number;
	timeoutMs?: number;
	numCtx?: number;
};

export interface LLMProvider {
	readonly name: string;
	sendPrompt(prompt: string, options?: LLMRequestOptions): Promise<string>;
	checkAvailability(): Promise<{ available: boolean; message?: string }>;
}
