import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

// ─── Version bump ─────────────────────────────────────

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
pkg.version = version;
writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json:', version);

const gradlePath = './android/app/build.gradle';
if (existsSync(gradlePath)) {
  let gradle = readFileSync(gradlePath, 'utf-8');
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  writeFileSync(gradlePath, gradle);
  console.log('✅ build.gradle:', version);
} else {
  console.warn('⚠️  Android project not found, skipping');
}

const pbxprojPath = './ios/App/App.xcodeproj/project.pbxproj';
if (existsSync(pbxprojPath)) {
  let pbxproj = readFileSync(pbxprojPath, 'utf-8');
  pbxproj = pbxproj.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  writeFileSync(pbxprojPath, pbxproj);
  console.log('✅ project.pbxproj:', version);
} else {
  console.warn('⚠️  iOS project not found, skipping');
}

// ─── Changelog ────────────────────────────────────────

// Collect commits from current branch only (since branching point from main/master)
let range = '';
try {
  const mergeBase = execSync('git merge-base HEAD main').toString().trim();
  range = `${mergeBase}..HEAD`;
} catch (mainError) {
  console.warn(`⚠️  Could not find base branch "main": ${mainError.message}`);

  try {
    const mergeBase = execSync('git merge-base HEAD master').toString().trim();
    range = `${mergeBase}..HEAD`;
  } catch (masterError) {
    console.warn('⚠️  Could not detect base branch, using full HEAD history');
    range = 'HEAD';
  }
}

const raw = execSync(`git log ${range} --pretty=format:"%s"`).toString().trim();
const commits = raw.split('\n').filter(Boolean);

const updates = [];
const fixes = [];
const releases = [];

for (const commit of commits) {
  // UPD:FIX — mixed commit, goes into both Updates and Fixes
  if (/^UPD:FIX:/i.test(commit)) {
    const msg = commit.replace(/^UPD:FIX:\d{4}-\d{2}-\d{2}::\s*/i, '');
    updates.push(msg);
    fixes.push(msg);
    continue;
  }

  // UPD: - Only Updates
  if (/^UPD:/i.test(commit)) {
    updates.push(commit.replace(/^UPD:\d{4}-\d{2}-\d{2}::\s*/i, ''));
    continue;
  }

  // REL:/RELEASE: - only releases
  if (/^(REL|RELEASE):/i.test(commit)) {
    releases.push(commit.replace(/^(REL|RELEASE):\d{4}-\d{2}-\d{2}::\s*/i, ''));
    continue;
  }
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

// Prepend new release entry on top, keep previous history below
let changelog = `# Changelog\n\n${newEntry}`;
if (existsSync('./CHANGELOG.md')) {
  const existing = readFileSync('./CHANGELOG.md', 'utf-8');
  const existingBody = existing.replace(/^# Changelog\n\n/, '');
  changelog += existingBody;
} else {
  console.log('ℹ️  No existing CHANGELOG.md found, creating a new one');
}

writeFileSync('./CHANGELOG.md', changelog);
console.log('✅ CHANGELOG.md generated');

// ─── Git ──────────────────────────────────────────────

execSync('git add .', { stdio: 'inherit' });
execSync(`git commit -m "RELEASE:${today}:: v${version}"`, { stdio: 'inherit' });
execSync(`git checkout -b v${version}`, { stdio: 'inherit' });
execSync(`git tag v${version}`, { stdio: 'inherit' });
execSync(`git push origin v${version}`, { stdio: 'inherit' });
execSync(`git push origin v${version} --tags`, { stdio: 'inherit' });

console.log(`\n🚀 Released v${version}`);
