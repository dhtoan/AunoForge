function escapeCommandProperty(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
}

function escapeCommandMessage(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

export function formatGitHubAnnotation(annotation) {
  const properties = [
    `file=${escapeCommandProperty(annotation.file)}`,
    `line=${annotation.line}`,
    `endLine=${annotation.endLine}`,
    `title=${escapeCommandProperty(annotation.title)}`,
  ].join(',');
  return `::${annotation.level} ${properties}::${escapeCommandMessage(annotation.message)}\n`;
}

export function emitGitHubAnnotations(
  annotations,
  write = (chunk) => process.stdout.write(chunk),
) {
  for (const annotation of annotations) {
    write(formatGitHubAnnotation(annotation));
  }
}
