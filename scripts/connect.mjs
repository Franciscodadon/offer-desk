#!/usr/bin/env node
/**
 * Walks through connecting the app to a Supabase project.
 *
 * This exists because the manual version of this step is editing a dotfile by
 * hand with two long strings pasted from a dashboard, and the two most common
 * outcomes are a stray space and pasting the wrong key. Both are caught here.
 */
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';

const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;

const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function checkUrl(value) {
  const url = value.trim().replace(/\/+$/, '');
  if (!url) return { error: 'That was empty. Paste the Project URL.' };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return {
      error:
        'That does not look like a Project URL. It should look like https://abcdefgh.supabase.co',
    };
  }
  return { value: url };
}

function checkKey(value) {
  const key = value.trim();
  if (!key) return { error: 'That was empty. Paste the anon public key.' };

  // Supabase keys are JWTs; the middle segment carries the role.
  const parts = key.split('.');
  if (parts.length !== 3) {
    return { error: 'That does not look like a Supabase key. It should have two dots in it.' };
  }

  let role;
  try {
    role = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role;
  } catch {
    return { error: 'That key could not be read. Copy it again from the dashboard.' };
  }

  if (role === 'service_role') {
    return {
      error:
        'That is the service_role key. It bypasses every security rule and must never go in the app.\n  Go back and copy the one labelled "anon" "public" instead.',
    };
  }
  if (role !== 'anon') {
    return { error: `That key has the role "${role}". You want the one labelled "anon" "public".` };
  }

  return { value: key };
}

async function ask(rl, question, check) {
  for (;;) {
    const answer = await rl.question(question);
    const result = check(answer);
    if (result.value) return result.value;
    console.log(`  ${red(result.error)}\n`);
  }
}

const rl = createInterface({ input: stdin, output: stdout });

console.log(`
${bold('Connect Offer Desk to Supabase')}

In your Supabase dashboard, open your project, then click the settings gear,
then ${bold('API')}. You need two things from that page.
`);

const url = await ask(rl, `${bold('1.')} Paste the Project URL: `, checkUrl);
const key = await ask(rl, `\n${bold('2.')} Paste the anon public key: `, checkKey);

if (existsSync(ENV_PATH)) {
  const existing = readFileSync(ENV_PATH, 'utf8');
  const answer = await rl.question(
    `\n.env.local already exists. Overwrite it? ${dim('(y/N)')} `,
  );
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('\nLeft it alone. Nothing changed.');
    rl.close();
    process.exit(0);
  }
  writeFileSync(`${ENV_PATH}.backup`, existing);
  console.log(dim('  Saved the old one as .env.local.backup'));
}

writeFileSync(
  ENV_PATH,
  `# Written by npm run connect. Safe to edit by hand.
# This file is gitignored: these values stay on this machine.
EXPO_PUBLIC_SUPABASE_URL=${url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}
`,
);

console.log(`
${green('Saved to .env.local')}

Next: ${bold('npm run doctor')} to check it works.
`);

rl.close();
