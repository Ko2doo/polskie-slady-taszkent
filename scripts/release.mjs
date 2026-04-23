import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const version = process.argv[2];

if (!version) {
  console.error('❌ Usage: node scripts/release.js 1.0.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('❌ Invalid version format. Expected: 1.0.0');
  process.exit(1);
}

// ─── Pre-flight checks ────────────────────────────────
const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

if (currentBranch !== 'master' && currentBranch !== 'main') {
  console.error(`❌ Releases must be created from main/master. Current: ${currentBranch}`);
  process.exit(1);
}

const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) {
  console.error('❌ Working tree is not clean. Commit or stash changes first.');
  process.exit(1);
}

const existingTags = execSync('git tag').toString().split('\n');
if (existingTags.includes(`v${version}`)) {
  console.error(`❌ Tag v${version} already exists`);
  process.exit(1);
}

// ─── Confirmation -------------------------------------
// readline question
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const answer = await rl.question(`\n[!] Confirm release v${version} on branch "${currentBranch}"? (Y/n): `);
rl.close();

if (answer.toLowerCase() !== 'y') {
  console.log('✅ Release cancelled. No changes were made.');
  process.exit(0);
}

console.log('🚀 Processing release...');

// ─── Version bump ─────────────────────────────────────

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
pkg.version = version;

// update package.json version
writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json:', version);

// Update Android version
const gradlePath = './android/app/build.gradle';
if (existsSync(gradlePath)) {
  let gradle = readFileSync(gradlePath, 'utf-8');

  // update version name
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

  gradle = gradle.replace(/versionCode\s+(\d+)/, (match, currentCode) => {
    const nextCode = parseInt(currentCode, 10) + 1;
    console.log(`🔢 versionCode updated: ${currentCode} -> ${nextCode}`);

    return `versionCode ${nextCode}`;
  });

  writeFileSync(gradlePath, gradle);
  console.log('✅ build.gradle updated to:', version);
} else {
  console.warn('[!] Android project not found, skipping');
}

// Update IOS version
const pbxprojPath = './ios/App/App.xcodeproj/project.pbxproj';
if (existsSync(pbxprojPath)) {
  let pbxproj = readFileSync(pbxprojPath, 'utf-8');

  pbxproj = pbxproj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);

  pbxproj = pbxproj.replace(/CURRENT_PROJECT_VERSION = (\d+);/g, (match, code) => {
    const nextCode = parseInt(code, 10) + 1;
    console.log(`🔢 iOS build number updated: ${code} -> ${nextCode}`);

    return `CURRENT_PROJECT_VERSION = ${nextCode};`;
  });

  writeFileSync(pbxprojPath, pbxproj);
  console.log('✅ project.pbxproj updated:', version);
} else {
  console.warn('[!] iOS project not found, skipping');
}

// ─── Changelog ────────────────────────────────────────

// Unified prefix regex: strips both "PREFIX:DATE::" and plain "PREFIX:" forms
const stripPrefix = (prefix, commit) =>
  commit.replace(new RegExp(`^${prefix}(?:\\d{4}-\\d{2}-\\d{2}::)?\\s*`, 'i'), '').trim();

// Try to find the last release tag
let range = '';

try {
  const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();

  range = `${lastTag}..HEAD`;
  console.log(`Collecting commits since last tag: ${lastTag}`);
} catch {
  console.log('No previous tags found, using full history');
}

// If no tags found > take full history
if (!range) {
  console.log('No tags found, using full commit history');
  range = '';
}

const raw = execSync(range ? `git log ${range} --pretty=format:"%s"` : `git log --pretty=format:"%s"`)
  .toString()
  .trim();
const commits = raw.split('\n').filter(Boolean);

console.log(`Found ${commits.length} commits to process`);

const updates = [];
const fixes = [];
const releases = [];
const other = [];

for (const commit of commits) {
  // Skip the release commit itself
  if (/^RELEASE:/i.test(commit) || /^REL:/i.test(commit)) {
    continue;
  }

  // UPD:FIX — mixed commit, goes into both Updates and Fixes
  if (/^UPD:FIX:/i.test(commit)) {
    const msg = stripPrefix('UPD:FIX:', commit);
    updates.push(msg);
    fixes.push(msg);
    continue;
  }

  // UPD: - Only Updates
  if (/^UPD:/i.test(commit)) {
    updates.push(stripPrefix('UPD:', commit));
    continue;
  }

  // FIX: - Only Fixes
  if (/^FIX:/i.test(commit)) {
    fixes.push(stripPrefix('FIX:', commit));
    continue;
  }

  // Everything else
  other.push(commit);
}

const today = new Date().toISOString().split('T')[0];

let newEntry = `## v${version} — ${today}\n\n`;

if (updates.length) {
  newEntry += `### 🆕 Updates\n${updates.map((m) => `- ${m}`).join('\n')}\n\n`;
}
if (fixes.length) {
  newEntry += `### 🐛 Fixes\n${fixes.map((m) => `- ${m}`).join('\n')}\n\n`;
}
if (releases.length) {
  newEntry += `### 🚀 Releases\n${releases.map((m) => `- ${m}`).join('\n')}\n\n`;
}
if (other.length) {
  newEntry += `### 📝 Other Changes\n${other.map((m) => `- ${m}`).join('\n')}\n\n`;
}

// Prepend new release entry on top, keep previous history below
let changelog = `# Changelog\n\n${newEntry}`;
if (existsSync('./CHANGELOG.md')) {
  const existing = readFileSync('./CHANGELOG.md', 'utf-8');
  const existingBody = existing.replace(/^# Changelog\n\n/, '');

  changelog += existingBody;
} else {
  console.log('No existing CHANGELOG.md found, creating a new one');
}

writeFileSync('./CHANGELOG.md', changelog);
console.log('✅ CHANGELOG.md generated');

// ─── Git ──────────────────────────────────────────────
try {
  console.log('📦 Committing and pushing...');

  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "RELEASE:${today}:: v${version}"`, { stdio: 'inherit' });

  // Create new release branch
  const branchName = `release-v${version}`;
  execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });

  // Create a tag
  execSync(`git tag v${version}`, { stdio: 'inherit' });

  // Pushing new branch and binding local branch
  execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

  // Push tag
  execSync(`git push origin v${version}`, { stdio: 'inherit' });

  console.log(`\n🚀 Released v${version} and tracked branch ${branchName} successfully!`);
} catch (error) {
  console.error('\n❌ Git execution failed. Please check your repository state.');
  console.error('\n❌ Git step failed:', error.message);
  console.error('Local commit and tag may already exist. Fix the issue and push manually:');
  console.error(`  git push -u origin release-v${version}`);
  console.error(`  git push origin v${version}`);
  process.exit(1);
}
