const patterns: Array<[RegExp, string]> = [
  [/sk-proj-[A-Za-z0-9_\-]{12,}/g, "[REDACTED_OPENAI_KEY]"],
  [/sk-ant-[A-Za-z0-9_\-]{12,}/g, "[REDACTED_ANTHROPIC_KEY]"],
  [/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_ACCESS_KEY]"],
  [/(aws_secret_access_key\s*[=:]\s*)[^\s]+/gi, "$1[REDACTED_AWS_SECRET]"],
  [/[a-z][a-z0-9+.-]*:\/\/[^\s:/]+:[^\s@]+@[^\s]+/gi, "[REDACTED_CREDENTIAL_URL]"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]"]
];

export function redactSecrets(input: string): string {
  let output = input;
  for (const [pattern, replacement] of patterns) output = output.replace(pattern, replacement);
  return output;
}

export function redactObject<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (/token|api.?key|authorization|secret|password/i.test(key)) result[key] = "[REDACTED]";
      else result[key] = redactObject(child);
    }
    return result as T;
  }
  return value;
}
