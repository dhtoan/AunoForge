import type { AnalysisRequest, AnalysisResponse, GenerationRequest, GenerationResponse } from "./contracts.js";
import { ValidationError } from "./contracts.js";

export type ProviderCapabilities = {
  structuredOutput: boolean;
  toolCalling: boolean;
  largeContext: boolean;
  streaming: boolean;
  patchGeneration: boolean;
};

export function validateProviderCapabilities(input: unknown): ProviderCapabilities {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("provider capabilities must be an object");
  const record = input as Record<string, unknown>;
  const result = {} as ProviderCapabilities;
  for (const key of ["structuredOutput", "toolCalling", "largeContext", "streaming", "patchGeneration"] as const) {
    if (typeof record[key] !== "boolean") throw new ValidationError(`${key} must be boolean`);
    result[key] = record[key] as boolean;
  }
  return result;
}

export interface AunoForgeProvider {
  readonly id: string;
  capabilities(): ProviderCapabilities;
  analyze(request: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisResponse>;
  generate(request: GenerationRequest, signal?: AbortSignal): Promise<GenerationResponse>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly code: string = "provider_error") {
    super(message);
    this.name = "ProviderError";
  }
}
