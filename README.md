# yst-skill

易奢堂 skill 仓库。

如果用户让 agent 从以下地址安装：

```text
https://github.com/WorkerXu/yst-skill/tree/main/eshetang
```

请优先读取并执行：

```text
eshetang/README.md
```

该 README 是安装指南，会要求 agent 在下载 skill 后立即运行：

```bash
./scripts/install-check.sh
```

环境检查脚本会自动准备 npm 依赖、Playwright Chromium，并在支持的系统包管理器下自动安装缺失的 `jq`、Node.js 和 npm。

安装完成后再读取：

```text
eshetang/SKILL.md
```

具体业务能力规则在：

```text
eshetang/references/
```
