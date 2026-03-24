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

const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

if (currentBranch !== 'master' && currentBranch !== 'main') {
  console.error(`❌ Releases must be created from main/master. Current: ${currentBranch}`);
  process.exit(1);
}

// Try to find the last release tag
let range = '';
// let lastTag = '';

// try {
//   // Get all tags sorted by version
//   const allTags = execSync('git tag -l "v*" --sort=-version:refname').toString().trim().split('\n').filter(Boolean);
//   if (allTags.length > 0) {
//     lastTag = allTags[0];
//     range = `${lastTag}..HEAD`;
//     console.log(`ℹ️  Collecting commits since last tag: ${lastTag}`);
//   }
// } catch (e) {
//   console.warn('⚠️  No previous tags found');
// }

try {
  const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();

  range = `${lastTag}..HEAD`;
  console.log(`ℹ️  Collecting commits since last tag: ${lastTag}`);
} catch {
  console.log('ℹ️  No previous tags found, using full history');
}

// // If no tags found, try to find merge base with main/master
// if (!range) {
//   try {
//     const mergeBase = execSync('git merge-base HEAD main').toString().trim();
//     range = `${mergeBase}..HEAD`;
//     console.log('ℹ️  Collecting commits since branching from main');
//   } catch (mainError) {
//     try {
//       const mergeBase = execSync('git merge-base HEAD master').toString().trim();
//       range = `${mergeBase}..HEAD`;
//       console.log('ℹ️  Collecting commits since branching from master');
//     } catch (masterError) {
//       console.warn('⚠️  Could not detect base branch, using last 50 commits');
//       range = 'HEAD~50..HEAD';
//     }
//   }
// }
// If no tags found > take full history
if (!range) {
  console.log('ℹ️  No tags found, using full commit history');
  range = '';
}

const raw = execSync(range ? `git log ${range} --pretty=format:"%s"` : `git log --pretty=format:"%s"`)
  .toString()
  .trim();
const commits = raw.split('\n').filter(Boolean);

console.log(`ℹ️  Found ${commits.length} commits to process`);

const updates = [];
const fixes = [];
const releases = [];
const other = [];

for (const commit of commits) {
  // Skip the release commit itself
  if (/^RELEASE:/i.test(commit)) {
    continue;
  }

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

  // FIX: - Only Fixes
  if (/^FIX:/i.test(commit)) {
    fixes.push(commit.replace(/^FIX:\d{4}-\d{2}-\d{2}::\s*/i, ''));
    continue;
  }

  // REL: - Releases (but we skip these above)
  if (/^REL:/i.test(commit)) {
    releases.push(commit.replace(/^REL:\d{4}-\d{2}-\d{2}::\s*/i, ''));
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
const changelog = `# Changelog\n\n${newEntry}`;
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

// Push branch and tag separately to avoid ambiguity
execSync(`git push origin refs/heads/v${version}`, { stdio: 'inherit' });
execSync(`git push origin refs/tags/v${version}`, { stdio: 'inherit' });

console.log(`\n🚀 Released v${version}`);
