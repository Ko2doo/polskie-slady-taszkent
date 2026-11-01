// UserPromptSubmit + Stop: the context budget.
//  - Stop: past the limit, ask the model once per session for a handover note.
//  - UserPromptSubmit: past the limit, refuse new prompts; "--force" in the prompt lets one through.
import { readFileSync } from 'node:fs';
import { block, readInput, sessionMemory } from './lib.mjs';

const LIMIT_TOKENS = 600_000;
const FORCE_FLAG = '--force';

/**
 * Size of the main conversation's context, from the usage of its last assistant message.
 * @param {string | undefined} transcriptPath - the session's transcript file
 * @returns {number} tokens, 0 when unknown
 */
function contextTokens(transcriptPath) {
  if (!transcriptPath) return 0;
  const lines = readFileSync(transcriptPath, 'utf8').split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!lines[index]) continue;
    let entry;
    try {
      entry = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    const usage = entry.message?.usage;
    if (entry.type !== 'assistant' || entry.isSidechain || !usage) continue;
    return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return 0;
}

const input = readInput();
const tokens = contextTokens(input.transcript_path);
if (tokens <= LIMIT_TOKENS) process.exit(0);

const thousands = Math.round(tokens / 1000);

if (input.hook_event_name === 'UserPromptSubmit') {
  if (input.prompt?.includes(FORCE_FLAG)) process.exit(0);
  block(
    `Context is ~${thousands}k tokens (limit ${LIMIT_TOKENS / 1000}k). Start a new session; add ${FORCE_FLAG} to continue anyway.`,
  );
}

const memory = sessionMemory('context', input.session_id);
if (input.stop_hook_active || memory.read().handoverRequested) process.exit(0);
memory.write({ handoverRequested: true });
block(
  `Context is ~${thousands}k tokens, over the ${LIMIT_TOKENS / 1000}k limit. Do not start anything new: ` +
    'leave the working tree coherent, then write a short handover (step in progress, files touched, ' +
    'what was verified, what is next) and tell the human to continue in a fresh session.',
);
