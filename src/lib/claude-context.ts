import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/root";

function readIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function loadTGVContext(): string {
  const stack = readIfExists(path.join(HOME, ".claude", "TGV-STACK.md"));
  const vocab = readIfExists(path.join(HOME, ".claude", "VOCABULARY-SUMMARIES.md"));
  const projectClaude = readIfExists(
    path.join(process.cwd(), "CLAUDE.md")
  );

  return [
    stack && `## TGV Canonical Stack\n${stack}`,
    vocab && `## UI Vocabulary\n${vocab}`,
    projectClaude && `## Project Config\n${projectClaude}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export function loadSandboxContext(registryCode: string, componentKey: string): string {
  const base = loadTGVContext();

  const sandboxSelf = `## Sandbox Claude — Self-Awareness

You are the Sandbox Claude, an AI assistant embedded inside the TGV Office Sandbox component preview.
You are looking at the live preview of component "${componentKey}" from the registry.

### What you can do:
- **Edit component code**: When the user asks you to change the component, return a JSON block with the updated code. Format: \`\`\`json\n{"action":"updateCode","code":"..."}\n\`\`\`
- **Deploy**: When the user says "deploy" or "ship it", return: \`\`\`json\n{"action":"deploy","targets":["all"]}\n\`\`\` or with specific targets.
- **Explain**: Explain what the current component does, its patterns, and how it fits the TGV vocabulary.

### Current component code:
\`\`\`tsx
${registryCode}
\`\`\`

### Rules:
- Always use styled-components (not Tailwind) for new styling.
- Follow the TGV color palette: pink=#ff4ecb, cyan=#00bfff, gold=#f7b700, orange=#d97757, violet=#a78bfa.
- Respect the vocabulary patterns (GPG, SBDM, DDM, Lightswitch, etc.).
- When editing code, return the COMPLETE updated code, not a diff.
- Be concise. The user is the admin — they know the system.`;

  return [base, sandboxSelf].join("\n\n---\n\n");
}
