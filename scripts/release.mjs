/**
 * Release script — two steps, built around a protected `master` (nobody pushes to it directly).
 *
 *   1. prepare (on `features`):
 *        npm run release -- prepare 1.3.0            # or 1.3.0-rc.1 (alpha|beta|rc|a|b)
 *        npm run release -- prepare 1.3.0 --dry-run  # show what would change, touch nothing
 *      (`--` is required: without it npm swallows `--dry-run` as its own flag)
 *      Bumps the version (package.json + lockfile, Android versionName/versionCode, iOS
 *      MARKETING_VERSION/CURRENT_PROJECT_VERSION), prepends a CHANGELOG.md entry, commits
 *      "RELEASE:<date>:: v<version>" and pushes `features`. Then open a PR features → master.
 *
 *   2. tag (after that PR is merged — on `features`, clean tree):
 *        npm run release -- tag
 *      Tags the tip of origin/master with the version from its package.json, pushes the tag,
 *      and fast-forwards `features` to `master` so both branches (and the tag) stay in one line
 *      of history — the next changelog then starts exactly at this tag.
 *
 * Both steps run on `features` only — never on `master`: `master` is protected and is never
 * checked out to release from, the script reads it as `origin/master`.
 *
 * The PR must be merged with a merge commit (not squash/rebase), otherwise `features` can't
 * fast-forward to `master` afterwards.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import readline from 'node:readline/promises';

const RELEASE_BRANCH = 'master';
const WORK_BRANCH = 'features';
const REMOTE = 'origin';

const VERSION_RE = /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc|a|b)(?:\.\d+)?)?$/;

const GRADLE_PATH = './android/app/build.gradle';
const PBXPROJ_PATH = './ios/App/App.xcodeproj/project.pbxproj';
const CHANGELOG_PATH = './CHANGELOG.md';
const CHANGELOG_HEADER = '# Changelog\n\n';

// ─── Helpers ──────────────────────────────────────────

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf-8' }).trim();
}

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n[!] ${question} (y/N): `);
  rl.close();

  return answer.trim().toLowerCase() === 'y';
}

function readPackageVersion() {
  return JSON.parse(readFileSync('./package.json', 'utf-8')).version;
}

function tagExists(tag) {
  const local = git(`tag --list ${tag}`) !== '';
  const remote = git(`ls-remote --tags ${REMOTE} refs/tags/${tag}`) !== '';

  return local || remote;
}

function assertOnWorkBranch() {
  const branch = git('rev-parse --abbrev-ref HEAD');
  if (branch !== WORK_BRANCH) {
    fail(`Run the release script on "${WORK_BRANCH}", never on "${RELEASE_BRANCH}". Current: ${branch}`);
  }
}

function assertCleanTree() {
  if (git('status --porcelain')) fail('Working tree is not clean. Commit or stash changes first.');
}

// "https://github.com/owner/repo" from either an ssh or an https remote url
function getRepoWebUrl() {
  const url = git(`remote get-url ${REMOTE}`);
  const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);

  return match ? `https://github.com/${match[1]}` : null;
}

// ─── Native project versions ──────────────────────────

/** Android: versionName = version, versionCode + 1. Returns the new file content or null. */
function bumpGradle(content, version) {
  return content
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
    .replace(/versionCode\s+(\d+)/, (_, code) => `versionCode ${Number(code) + 1}`);
}

/** iOS: MARKETING_VERSION = version, CURRENT_PROJECT_VERSION + 1 (every build configuration). */
function bumpPbxproj(content, version) {
  return content
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = (\d+);/g, (_, code) => `CURRENT_PROJECT_VERSION = ${Number(code) + 1};`);
}

// ─── Changelog ────────────────────────────────────────

// Strips both "PREFIX:DATE::" and plain "PREFIX:" forms
function stripPrefix(prefix, subject) {
  return subject.replace(new RegExp(`^${prefix}(?:\\d{4}-\\d{2}-\\d{2}::)?\\s*`, 'i'), '').trim();
}

/** Commit subjects since the last tag reachable from HEAD (merge commits excluded). */
function collectCommitSubjects() {
  let range = '';

  try {
    const lastTag = git('describe --tags --abbrev=0');
    range = `${lastTag}..HEAD`;
    console.log(`Collecting commits since last tag: ${lastTag}`);
  } catch {
    console.log('No previous tags found, using full history');
  }

  const raw = git(`log ${range} --no-merges --pretty=format:%s`);

  return raw.split('\n').filter(Boolean);
}

/** Groups subjects by prefix: UPD → Updates, FIX → Fixes, UPD:FIX → both, RELEASE/REL skipped. */
function groupCommits(subjects) {
  const groups = { updates: [], fixes: [], other: [] };

  for (const subject of subjects) {
    if (/^(RELEASE|REL):/i.test(subject)) continue;

    if (/^UPD:FIX:/i.test(subject)) {
      const message = stripPrefix('UPD:FIX:', subject);
      groups.updates.push(message);
      groups.fixes.push(message);
    } else if (/^UPD:/i.test(subject)) {
      groups.updates.push(stripPrefix('UPD:', subject));
    } else if (/^FIX:/i.test(subject)) {
      groups.fixes.push(stripPrefix('FIX:', subject));
    } else {
      groups.other.push(subject);
    }
  }

  return groups;
}

function formatChangelogEntry(version, date, groups) {
  const section = (title, items) => (items.length ? `### ${title}\n${items.map((m) => `- ${m}`).join('\n')}\n\n` : '');

  return (
    `## v${version} — ${date}\n\n` +
    section('🆕 Updates', groups.updates) +
    section('🐛 Fixes', groups.fixes) +
    section('📝 Other Changes', groups.other)
  );
}

function prependChangelog(entry) {
  const existing = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, 'utf-8') : '';
  const body = existing.replace(/^# Changelog\n\n/, '');

  writeFileSync(CHANGELOG_PATH, `${CHANGELOG_HEADER}${entry}${body}`);
}

// ─── Step 1: prepare ──────────────────────────────────

async function prepare(version, { dryRun }) {
  const currentVersion = readPackageVersion();

  if (!version) fail(`Usage: npm run release -- prepare <version> [--dry-run]\n   current version: ${currentVersion}`);
  if (!VERSION_RE.test(version)) fail('Invalid version format. Expected: 1.0.0 or 1.0.0-rc.1 (alpha|beta|rc|a|b)');
  if (version === currentVersion) fail(`Version ${version} is already the current version.`);

  assertOnWorkBranch();

  // A dry run only reads, so it may run on a dirty tree
  if (!dryRun) assertCleanTree();

  git(`fetch ${REMOTE} --tags`);
  if (git(`rev-list --count HEAD..${REMOTE}/${WORK_BRANCH}`) !== '0') {
    fail(`"${WORK_BRANCH}" is behind ${REMOTE}/${WORK_BRANCH}. Pull first.`);
  }
  if (tagExists(`v${version}`)) fail(`Tag v${version} already exists.`);

  const date = new Date().toISOString().split('T')[0];
  const subjects = collectCommitSubjects();
  const entry = formatChangelogEntry(version, date, groupCommits(subjects));

  console.log(`\n${currentVersion} → ${version}, ${subjects.length} commits. CHANGELOG entry:\n\n${entry}`);

  if (dryRun) {
    console.log('Dry run: nothing was changed.');
    return;
  }

  if (!(await confirm(`Prepare release v${version} on "${WORK_BRANCH}" and push it?`))) {
    console.log('Release cancelled. No changes were made.');
    return;
  }

  // npm keeps package.json and package-lock.json in sync and preserves their formatting
  run(`npm version ${version} --no-git-tag-version`);

  const changedFiles = ['package.json', 'package-lock.json', CHANGELOG_PATH];

  for (const [path, bump] of [
    [GRADLE_PATH, bumpGradle],
    [PBXPROJ_PATH, bumpPbxproj],
  ]) {
    if (!existsSync(path)) {
      console.warn(`[!] ${path} not found, skipping`);
      continue;
    }

    writeFileSync(path, bump(readFileSync(path, 'utf-8'), version));
    changedFiles.push(path);
    console.log(`✅ ${path} updated`);
  }

  prependChangelog(entry);
  console.log('✅ CHANGELOG.md updated');

  // Only the files this script changed, never `git add .`
  run(`git add ${changedFiles.map((path) => `"${path}"`).join(' ')}`);
  run(`git commit -m "RELEASE:${date}:: v${version}"`);
  run(`git push ${REMOTE} ${WORK_BRANCH}`);

  const repoUrl = getRepoWebUrl();
  console.log(`\n✅ Release v${version} prepared on "${WORK_BRANCH}".`);
  console.log('Next: open a PR features → master, wait for CI, merge it with a MERGE COMMIT, then run:');
  console.log('   npm run release -- tag');
  if (repoUrl) console.log(`PR: ${repoUrl}/compare/${RELEASE_BRANCH}...${WORK_BRANCH}?expand=1`);
}

// ─── Step 2: tag ──────────────────────────────────────

async function tag() {
  assertOnWorkBranch();
  assertCleanTree();
  git(`fetch ${REMOTE} --tags`);

  const releaseRef = `${REMOTE}/${RELEASE_BRANCH}`;
  const version = JSON.parse(git(`show ${releaseRef}:package.json`)).version;
  const tagName = `v${version}`;

  if (tagExists(tagName)) fail(`Tag ${tagName} already exists — was the release PR merged?`);

  const sha = git(`rev-parse ${releaseRef}`);
  const subject = git(`log -1 --format=%s ${sha}`);

  console.log(`\n${releaseRef} is at ${sha.slice(0, 7)} "${subject}", version ${version}.`);

  if (!(await confirm(`Tag it as ${tagName} and push the tag?`))) {
    console.log('Cancelled. No changes were made.');
    return;
  }

  run(`git tag ${tagName} ${sha}`);
  run(`git push ${REMOTE} ${tagName}`);
  console.log(`✅ ${tagName} pushed.`);

  // Fast-forward only: git refuses the push if features got new commits in the meantime
  try {
    run(`git push ${REMOTE} ${releaseRef}:refs/heads/${WORK_BRANCH}`);
    console.log(`✅ ${REMOTE}/${WORK_BRANCH} fast-forwarded to ${RELEASE_BRANCH}.`);
  } catch {
    console.warn(`[!] Could not fast-forward ${REMOTE}/${WORK_BRANCH} (it has commits ${RELEASE_BRANCH} doesn't).`);
    console.warn(`    Merge ${RELEASE_BRANCH} into ${WORK_BRANCH} by hand so the next changelog starts at ${tagName}.`);
  }

  console.log(`\nUpdate your local "${WORK_BRANCH}": git pull`);
  console.log(`For native builds, check out the tag or "${RELEASE_BRANCH}" (read-only): git checkout ${tagName}`);
  console.log(`\n🚀 Released ${tagName}. Native builds come from "${RELEASE_BRANCH}".`);
}

// ─── Entry point ──────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

if (command === 'prepare') {
  await prepare(args.find((arg) => !arg.startsWith('--')), { dryRun: args.includes('--dry-run') });
} else if (command === 'tag') {
  await tag();
} else {
  fail('Usage:\n   npm run release -- prepare <version> [--dry-run]\n   npm run release -- tag');
}
