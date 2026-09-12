import type { AnalysisRequest, AnalysisResponse, GenerationRequest, GenerationResponse, AunoForgeProvider, ProviderCapabilities } from "@aunoforge/core";

export type MockProviderOptions = {
  analyze?: (request: AnalysisRequest) => AnalysisResponse | Promise<AnalysisResponse>;
  generate?: (request: GenerationRequest) => GenerationResponse | Promise<GenerationResponse>;
};

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("Operation aborted");
    error.name = "AbortError";
    throw error;
  }
}

export class MockProvider implements AunoForgeProvider {
  readonly id = "mock";
  constructor(private readonly options: MockProviderOptions = {}) {}
  capabilities(): ProviderCapabilities {
    return { structuredOutput: true, toolCalling: false, largeContext: true, streaming: false, patchGeneration: false };
  }
  async analyze(request: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisResponse> {
    ensureNotAborted(signal);
    const result = this.options.analyze ? await this.options.analyze(request) : { findings: [], data: {} };
    ensureNotAborted(signal);
    return result;
  }
  async generate(request: GenerationRequest, signal?: AbortSignal): Promise<GenerationResponse> {
    ensureNotAborted(signal);
    let result: GenerationResponse;
    if (this.options.generate) result = await this.options.generate(request);
    else if (request.outputKind === "triage-report/v1") result = { data: {
      type:"unknown", component:"unknown", severity:"info", confidence:0, suggestedLabels:[],
      missingInformation:["Mock provider does not infer issue-specific details."],
      nextAction:"Use a live provider or an injected mock response for issue-specific triage."
    } };
    else if (request.outputKind === "reproduction-plan/v1") result = { data: {
      environment:["Not inferred by mock provider."],
      steps:["Use a live provider or an injected mock response for issue-specific reproduction steps."],
      expected:"Not inferred by mock provider.", actual:"Not inferred by mock provider.",
      likelyAffectedAreas:[], missingEvidence:["Issue-specific evidence was not inferred by mock provider."]
    } };
    else result = { data: {} };
    ensureNotAborted(signal);
    return result;
  }
}
