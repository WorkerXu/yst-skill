# eshetang skill 安装指南

这是易奢堂后台管理 skill。


## 安装目标

把当前目录作为一个  skill 安装到本机 skill 目录中，目录名保持为：

```text
eshetang
```

安装后应能读取：

```text
SKILL.md
references/
scripts/
tools/
package.json
```

## Agent 安装流程

### Step 1: 下载 skill

从 GitHub 下载 `main` 分支中的 `eshetang` 目录。

如果 agent 支持内置 skill 安装器，优先使用安装器完成目录下载。

如果需要手动下载，可以使用以下等价方式之一：

```bash
git clone --depth 1 https://github.com/WorkerXu/yst-skill.git
```

然后只安装仓库中的：

```text
eshetang/
```

### Step 2: 进入 skill 目录

安装完成后，进入已安装的 `eshetang` 目录。

不要使用 README 中的示例路径作为固定路径；应以实际安装位置为准。

### Step 3: 自动执行环境检查

下载完成后必须立即执行：

```bash
./scripts/install-check.sh
```

这一步不是可选项。它会检查并准备：

- Node.js
- npm
- jq
- npm 依赖
- Playwright Chromium

### Step 4: 自动安装缺失环境

如果 `./scripts/install-check.sh` 发现可自动安装的缺失项，应自动安装，不要只给用户一段手动说明。

当前脚本会自动执行：

- `npm install`
- `npx playwright install chromium`
- 在支持 Homebrew、apt-get 或 apk 的环境中自动安装 `jq`
- 在支持 Homebrew、apt-get 或 apk 的环境中尝试自动安装 Node.js 和 npm

如果缺少 Node.js、npm，或当前系统没有可用的自动安装方式，agent 应：

- 明确说明缺失项
- 说明无法自动安装的原因
- 询问用户是否允许安装系统依赖
- 获得许可后继续安装

### Step 5: 验证安装结果

环境检查完成后，运行：

```bash
./scripts/status.sh
```

如果命令能返回 JSON 状态，说明 skill 工具链已可用。

未登录是正常状态，不代表安装失败。