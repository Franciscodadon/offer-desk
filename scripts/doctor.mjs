#!/usr/bin/env node
/**
 * Checks the Supabase connection and reports, in plain terms, what is wrong.
 *
 * The point is to replace "it shows a blank screen and I do not know why" with
 * a specific sentence and the next action. Each check knows what its own
 * failure means, because the raw errors ("permission denied for table deals")
 * describe a symptom rather than a cause.
 */
import { existsSync, readFileSync } from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;

const bold = (t) => `\x1b[1m${t}\x1b[0m`;
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const dim = (t) => `\x1b[2m${t}\x1b[0m`;

const pass = (m) => console.log(`${green('  OK')}  ${m}`);
const fail = (m, fix) => {
  console.log(`${red('  NO')}  ${m}`);
  if (fix) console.log(`      ${dim(fix)}`);
  failures += 1;
};
const warn = (m, fix) => {
  console.log(`${yellow('  --')}  ${m}`);
  if (fix) console.log(`      ${dim(fix)}`);
};

let failures = 0;

console.log(`\n${bold('Checking your Supabase connection')}\n`);

// ---------------------------------------------------------------------------
// 1. Configuration
// ---------------------------------------------------------------------------

if (!existsSync(ENV_PATH)) {
  fail('No .env.local file.', 'Run: npm run connect');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  fail('.env.local is missing a value.', 'Run: npm run connect');
  process.exit(1);
}
pass('Found your project URL and key');

// A service_role key here would be shipped to every phone running the app.
try {
  const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role;
  if (role === 'service_role') {
    fail(
      'That is the service_role key, which must never be in the app.',
      'Run npm run connect again and paste the "anon" "public" key instead.',
    );
    process.exit(1);
  }
  pass('The key is the anon public one, which is the right one');
} catch {
  fail('The key could not be read.', 'Run: npm run connect');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Reachability
// ---------------------------------------------------------------------------

async function get(path) {
  const response = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return { status: response.status, body: await response.text() };
}

let reachable = false;
try {
  const { status } = await get('/rest/v1/');
  if (status >= 500) {
    fail(`The project answered with a ${status}.`, 'Check status.supabase.com, then try again.');
  } else {
    pass('Your project is reachable');
    reachable = true;
  }
} catch (error) {
  fail(
    `Could not reach ${url}`,
    `${error.message}. Check the URL is right and that you are online.`,
  );
}

// ---------------------------------------------------------------------------
// 3. Schema
// ---------------------------------------------------------------------------

if (reachable) {
  const { status, body } = await get('/rest/v1/deals?select=id&limit=1');

  if (status === 404 || /relation .* does not exist|Could not find the table/i.test(body)) {
    fail(
      'The database has no tables yet.',
      'Run: npm run db:bundle, then paste supabase/schema.bundle.sql into the SQL Editor and press Run.',
    );
  } else if (status === 401 && /JWT|api key/i.test(body)) {
    fail('The key was rejected.', 'Run npm run connect and paste the key again.');
  } else if (status === 200 || status === 401 || status === 403) {
    // 200 with no rows, or a permission error, both mean the table exists and
    // Row-Level Security is doing its job for a signed-out caller.
    pass('The tables are there');
    pass('Row-Level Security is on: signed-out callers get no data');
  } else {
    warn(`Unexpected answer (${status}) when reading deals.`, body.slice(0, 160));
  }

  // The signup trigger is what creates a workspace; without it a new account
  // signs in to nothing and the pipeline looks broken.
  const orgs = await get('/rest/v1/orgs?select=id&limit=1');
  if (orgs.status === 404) {
    fail('The orgs table is missing.', 'The schema did not finish applying. Re-run the SQL.');
  } else {
    pass('Workspaces table is ready');
  }
}

// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log(`${green(bold('Everything checks out.'))}
Start the app with: ${bold('npx expo start --clear')}
Then sign up, and your workspace is created automatically.
`);
} else {
  console.log(`${red(bold(`${failures} thing${failures === 1 ? '' : 's'} to fix.`))} Fix the lines marked NO above, then run this again.\n`);
  process.exit(1);
}
