# 8.4 打包发布

## 学习目标

掌握打包配置、npm 发布、版本管理和 CHANGELOG 维护。

## 1. 打包配置

### 1.1 TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 1.2 package.json 配置

```json
{
  "name": "minicode-cli",
  "version": "1.0.0",
  "description": "AI-powered coding CLI assistant",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "bin": {
    "minicode": "dist/bin.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./cli": {
      "import": "./dist/cli/index.mjs",
      "require": "./dist/cli/index.js",
      "types": "./dist/cli/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsx watch src/bin.ts",
    "start": "node dist/bin.js",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "prepublishOnly": "npm run build && npm test"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "ai",
    "cli",
    "coding",
    "assistant",
    "openai",
    "anthropic"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/minicode-cli"
  },
  "bugs": {
    "url": "https://github.com/yourusername/minicode-cli/issues"
  },
  "homepage": "https://github.com/yourusername/minicode-cli#readme",
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "inquirer": "^9.2.12",
    "openai": "^4.24.0",
    "@anthropic-ai/sdk": "^0.17.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.0",
    "@types/inquirer": "^9.0.7",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "tsup": "^8.0.1",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  },
  "peerDependencies": {
    "typescript": ">=5.0.0"
  }
}
```

### 1.3 tsup 打包配置

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  // 主入口
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    external: ['openai', '@anthropic-ai/sdk'],
  },
  // CLI 入口
  {
    entry: { bin: 'src/bin.ts' },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    minify: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['openai', '@anthropic-ai/sdk'],
  },
]);
```

### 1.4 构建脚本

```typescript
// scripts/build.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 构建函数
async function build() {
  console.log('🔨 Building minicode-cli...\n');

  // 1. 清理旧文件
  console.log('📦 Cleaning dist directory...');
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 2. 运行 tsup
  console.log('📦 Running tsup...');
  execSync('npx tsup', { stdio: 'inherit' });

  // 3. 复制必要文件
  console.log('📦 Copying additional files...');
  const filesToCopy = ['README.md', 'LICENSE'];
  for (const file of filesToCopy) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(distDir, file));
    }
  }

  // 4. 生成 package.json
  console.log('📦 Generating package.json for dist...');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    main: pkg.main,
    module: pkg.module,
    types: pkg.types,
    bin: pkg.bin,
    exports: pkg.exports,
    files: ['.'],
    scripts: {},
    dependencies: pkg.dependencies,
    peerDependencies: pkg.peerDependencies,
    engines: pkg.engines,
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    repository: pkg.repository,
    bugs: pkg.bugs,
    homepage: pkg.homepage,
  };
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );

  console.log('\n✅ Build complete!');
}

build().catch(console.error);
```

## 2. npm 发布

### 2.1 发布前检查

```typescript
// scripts/prepublish.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function prepublish() {
  console.log('🔍 Running pre-publish checks...\n');

  const errors: string[] = [];

  // 1. 检查是否有未提交的更改
  try {
    const status = execSync('git status --porcelain').toString();
    if (status.trim()) {
      errors.push('There are uncommitted changes');
    }
  } catch (e) {
    errors.push('Not in a git repository');
  }

  // 2. 检查 dist 目录是否存在
  if (!fs.existsSync('dist')) {
    errors.push('dist directory does not exist. Run build first.');
  }

  // 3. 检查必要文件
  const requiredFiles = ['README.md', 'LICENSE', 'package.json'];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // 4. 检查 package.json 字段
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (!pkg.name) errors.push('package.json missing name');
  if (!pkg.version) errors.push('package.json missing version');
  if (!pkg.description) errors.push('package.json missing description');
  if (!pkg.license) errors.push('package.json missing license');
  if (!pkg.repository) errors.push('package.json missing repository');

  // 5. 运行测试
  console.log('🧪 Running tests...');
  try {
    execSync('npm test', { stdio: 'inherit' });
  } catch (e) {
    errors.push('Tests failed');
  }

  // 6. 运行 lint
  console.log('🔍 Running lint...');
  try {
    execSync('npm run lint', { stdio: 'inherit' });
  } catch (e) {
    errors.push('Lint failed');
  }

  if (errors.length > 0) {
    console.error('\n❌ Pre-publish checks failed:\n');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ All pre-publish checks passed!');
}

prepublish().catch(console.error);
```

### 2.2 发布脚本

```bash
#!/bin/bash
# scripts/publish.sh

set -e

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "Current version: $CURRENT_VERSION"
echo ""

# 选择发布类型
echo "Select release type:"
echo "  1) patch (1.0.0 -> 1.0.1)"
echo "  2) minor (1.0.0 -> 1.1.0)"
echo "  3) major (1.0.0 -> 2.0.0)"
echo "  4) custom version"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
  1) BUMP="patch" ;;
  2) BUMP="minor" ;;
  3) BUMP="major" ;;
  4)
    read -p "Enter version: " CUSTOM_VERSION
    BUMP=$CUSTOM_VERSION
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

# 运行测试
echo ""
echo "Running tests..."
npm test

# 构建
echo ""
echo "Building..."
npm run build

# 升级版本
echo ""
echo "Bumping version..."
if [ "$choice" = "4" ]; then
  npm version $BUMP --no-git-tag-version
else
  npm version $BUMP
fi

# 获取新版本
NEW_VERSION=$(node -p "require('./package.json').version")

# 发布到 npm
echo ""
echo "Publishing version $NEW_VERSION to npm..."
npm publish --access public

# 推送到 Git
echo ""
echo "Pushing to Git..."
git push
git push --tags

echo ""
echo "✅ Successfully published minicode-cli@$NEW_VERSION"
```

### 2.3 .npmignore 配置

```
# .npmignore
src/
tests/
coverage/
*.test.ts
*.spec.ts
tsconfig.json
jest.config.ts
.eslintrc
.prettierrc
.github/
.git/
node_modules/
*.log
.DS_Store
```

## 3. 版本管理

### 3.1 语义化版本

```typescript
// scripts/version.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 语义化版本类型
type VersionBump = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';

// 版本管理
class VersionManager {
  private pkgPath: string;

  constructor() {
    this.pkgPath = path.join(process.cwd(), 'package.json');
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    const pkg = this.readPackageJson();
    return pkg.version;
  }

  /**
   * 升级版本
   */
  bump(type: VersionBump, prereleaseId?: string): string {
    const current = this.getCurrentVersion();
    const newVersion = this.calculateNewVersion(current, type, prereleaseId);

    // 更新 package.json
    this.updatePackageVersion(newVersion);

    // 更新 CHANGELOG
    this.updateChangelog(current, newVersion);

    // 创建 Git tag
    this.createGitTag(newVersion);

    return newVersion;
  }

  /**
   * 计算新版本号
   */
  private calculateNewVersion(
    current: string,
    type: VersionBump,
    prereleaseId?: string
  ): string {
    const [major, minor, patch] = current.split('.').map(Number);
    const prerelease = current.includes('-')
      ? current.split('-')[1]
      : undefined;

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      case 'premajor':
        return `${major + 1}.0.0-${prereleaseId || 'alpha'}.0`;
      case 'preminor':
        return `${major}.${minor + 1}.0-${prereleaseId || 'alpha'}.0`;
      case 'prepatch':
        return `${major}.${minor}.${patch + 1}-${prereleaseId || 'alpha'}.0`;
      case 'prerelease':
        if (prerelease) {
          const [id, num] = prerelease.split('.');
          return `${major}.${minor}.${patch}-${id}.${parseInt(num) + 1}`;
        }
        return `${major}.${minor}.${patch}-${prereleaseId || 'alpha'}.0`;
      default:
        throw new Error(`Unknown version bump type: ${type}`);
    }
  }

  /**
   * 更新 package.json 版本
   */
  private updatePackageVersion(version: string): void {
    const pkg = this.readPackageJson();
    pkg.version = version;
    fs.writeFileSync(this.pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  /**
   * 更新 CHANGELOG
   */
  private updateChangelog(oldVersion: string, newVersion: string): void {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
      fs.writeFileSync(changelogPath, '# Changelog\n\n');
    }

    // 获取最近的提交
    const commits = execSync(`git log v${oldVersion}..HEAD --oneline --no-merges || git log --oneline -20`)
      .toString()
      .trim()
      .split('\n')
      .map(line => `  - ${line}`)
      .join('\n');

    const content = fs.readFileSync(changelogPath, 'utf-8');

    const newEntry = `## [${newVersion}] - ${new Date().toISOString().split('T')[0]}

${commits}

`;

    // 在开头插入新条目
    const updated = content.replace('# Changelog\n\n', `# Changelog\n\n${newEntry}`);
    fs.writeFileSync(changelogPath, updated);
  }

  /**
   * 创建 Git tag
   */
  private createGitTag(version: string): void {
    execSync(`git add package.json CHANGELOG.md`);
    execSync(`git commit -m "chore: release v${version}"`);
    execSync(`git tag v${version}`);
  }

  /**
   * 读取 package.json
   */
  private readPackageJson(): any {
    return JSON.parse(fs.readFileSync(this.pkgPath, 'utf-8'));
  }
}

// CLI 使用
const manager = new VersionManager();
const args = process.argv.slice(2);
const type = args[0] as VersionBump;
const prereleaseId = args[1];

if (!type) {
  console.log(`Current version: ${manager.getCurrentVersion()}`);
  console.log('Usage: npm run version <major|minor|patch>');
  process.exit(0);
}

const newVersion = manager.bump(type, prereleaseId);
console.log(`Version bumped: ${newVersion}`);
```

## 4. CHANGELOG 管理

### 4.1 CHANGELOG 格式

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-01-15

### Added
- New skill system for extensible commands
- Support for custom hooks
- MCP protocol integration

### Changed
- Improved streaming performance
- Better error messages

### Fixed
- Session persistence issue
- Token counting for Chinese text

### Deprecated
- Old configuration format (will be removed in 2.0.0)

## [1.1.0] - 2024-01-01

### Added
- Initial release
- Basic chat functionality
- File operations
- Command execution

## [1.0.0] - 2023-12-01

### Added
- Project initialization

[1.2.0]: https://github.com/user/minicode-cli/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/user/minicode-cli/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/minicode-cli/releases/tag/v1.0.0
```

### 4.2 自动生成 CHANGELOG

```typescript
// scripts/changelog.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Commit {
  hash: string;
  type: string;
  scope?: string;
  description: string;
  breaking?: boolean;
}

// 解析 conventional commit
function parseCommit(line: string): Commit | null {
  const match = line.match(/^([a-f0-9]+) (feat|fix|docs|style|refactor|test|chore)(?:\(([^)]+)\))?: (.+)$/);

  if (!match) return null;

  const [, hash, type, scope, description] = match;

  return {
    hash,
    type,
    scope,
    description,
    breaking: description.includes('BREAKING CHANGE') || description.includes('!'),
  };
}

// 生成 CHANGELOG 条目
function generateChangelog(version: string, commits: Commit[]): string {
  const grouped: Record<string, Commit[]> = {
    breaking: [],
    feat: [],
    fix: [],
    docs: [],
    refactor: [],
    other: [],
  };

  for (const commit of commits) {
    if (commit.breaking) {
      grouped.breaking.push(commit);
    } else if (grouped[commit.type]) {
      grouped[commit.type].push(commit);
    } else {
      grouped.other.push(commit);
    }
  }

  const lines: string[] = [`## [${version}] - ${new Date().toISOString().split('T')[0]}`, ''];

  const typeLabels: Record<string, string> = {
    breaking: 'BREAKING CHANGES',
    feat: 'Added',
    fix: 'Fixed',
    docs: 'Documentation',
    refactor: 'Changed',
    other: 'Other',
  };

  for (const [type, label] of Object.entries(typeLabels)) {
    const typeCommits = grouped[type];
    if (typeCommits.length === 0) continue;

    lines.push(`### ${label}`);
    for (const commit of typeCommits) {
      const scope = commit.scope ? `**${commit.scope}**: ` : '';
      lines.push(`- ${scope}${commit.description} (${commit.hash.slice(0, 7)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const version = args[0];

  if (!version) {
    console.error('Usage: npm run changelog <version>');
    process.exit(1);
  }

  // 获取最近的 tag
  let lastTag = '';
  try {
    lastTag = execSync('git describe --tags --abbrev=0 HEAD~1').toString().trim();
  } catch {
    // 没有 tag，获取所有提交
  }

  // 获取提交列表
  const gitLog = lastTag
    ? execSync(`git log ${lastTag}..HEAD --oneline --no-merges`).toString()
    : execSync('git log --oneline --no-merges -50').toString();

  const commits = gitLog
    .trim()
    .split('\n')
    .map(parseCommit)
    .filter((c): c is Commit => c !== null);

  // 生成 CHANGELOG
  const entry = generateChangelog(version, commits);

  // 更新文件
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  let content = '';

  if (fs.existsSync(changelogPath)) {
    content = fs.readFileSync(changelogPath, 'utf-8');
    // 在第一个版本条目前插入
    const firstVersionIndex = content.indexOf('\n## [');
    if (firstVersionIndex > 0) {
      content = content.slice(0, firstVersionIndex) + '\n' + entry + content.slice(firstVersionIndex);
    } else {
      content += '\n' + entry;
    }
  } else {
    content = `# Changelog\n\n${entry}`;
  }

  fs.writeFileSync(changelogPath, content);
  console.log(`Updated CHANGELOG.md for version ${version}`);
}

main().catch(console.error);
```

## 5. CI/CD 配置

### 5.1 GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 5.2 CI 测试

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## 练习题

### 练习 1: 实现自动化发布

```typescript
// exercises/01-auto-release.ts
// TODO: 实现完全自动化的发布流程
// 要求：
// 1. 检测代码变更
// 2. 自动升级版本
// 3. 自动发布

export class AutoReleaser {
  // TODO: 实现
}
```

### 练习 2: 实现多包管理

```typescript
// exercises/02-monorepo.ts
// TODO: 实现 monorepo 版本管理
// 要求：
// 1. 检测包之间的依赖
// 2. 按顺序发布
// 3. 更新内部依赖

export class MonorepoManager {
  // TODO: 实现
}
```

### 练习 3: 实现回滚机制

```typescript
// exercises/03-rollback.ts
// TODO: 实现发布回滚
// 要求：
// 1. 记录发布状态
// 2. 支持回滚到上一版本
// 3. 回滚 Git 和 npm

export class ReleaseRollback {
  // TODO: 实现
}
```

### 练习 4: 实现发布通知

```typescript
// exercises/04-notification.ts
// TODO: 实现发布通知系统
// 要求：
// 1. 发送到 Slack/Discord
// 2. 包含变更摘要
// 3. 包含安装命令

export class ReleaseNotifier {
  // TODO: 实现
}
```

## 恭喜完成全部课程！

你已经完成了 AI Coding CLI 从零到一的全部学习！

### 回顾

通过这 8 章的学习，你已经掌握了：

1. **基础入门** - TypeScript 异步编程、CLI 框架、文件操作、配置管理
2. **AI 集成** - Provider 模式、OpenAI/Anthropic SDK、模型抽象
3. **流式处理** - SSE 原理、流式 API、实时渲染
4. **工具系统** - JSON Schema、工具注册、Tool Calling、安全执行
5. **会话管理** - 消息结构、存储方案、上下文管理、Token 优化
6. **CLI 界面** - REPL 设计、进度显示、命令路由、配置界面
7. **高级功能** - MCP 协议、技能系统、钩子系统、Git 集成
8. **完整项目** - 架构设计、代码整合、测试调试、打包发布

### 下一步建议

1. 实践项目：用学到的知识构建自己的 AI CLI 工具
2. 深入研究：阅读 Claude Code、Aider 等开源项目源码
3. 贡献社区：为相关项目贡献代码
4. 持续学习：关注 AI 技术的最新发展
