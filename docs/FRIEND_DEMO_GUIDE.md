# Project A 演示包使用说明

这份包是给答辩演示用的本地部署版：前端页面已经打包好，由后端同一个服务托管。正常情况下只需要启动一个脚本，然后打开一个本地网址。

## 答辩前一定先做一次

1. 解压 `Project-A-demo-*.zip`。
2. 打开 Codex，让它进入解压后的 `Project-A-demo` 文件夹。
3. 如果是 macOS，让 Codex 运行：

```bash
./scripts/start_demo.command
```

如果是 Windows，让 Codex 运行：

```bat
scripts\start_demo_windows.bat
```

第一次启动会创建 `.demo-venv` 并安装 Python 依赖，需要联网。答辩当天不要第一次才运行。

## DeepSeek key

如果只是看工作台、基金池、市场参考和已有本地数据，可以不填 key。

如果要点击“开始分析/生成营销材料”，必须配置 DeepSeek key：

```bash
cp .env.example .env
```

然后把 `.env` 里的 `DEEPSEEK_API_KEY=sk-your-key` 改成真实 key。

不要把 `.env` 发到公开仓库或群里。

## 启动方式

macOS：

```bash
./scripts/start_demo.command
```

Windows：

```bat
scripts\start_demo_windows.bat
```

脚本会自动选择 `8000-8010` 中空闲的本地端口，并尝试打开浏览器。如果浏览器没有自动打开，就复制终端里显示的地址，例如：

```text
http://127.0.0.1:8000
```

演示过程中不要关闭终端窗口。结束后在终端按 `Ctrl+C`。

Windows 电脑需要提前安装 Python 3.11 或更新版本。安装 Python 时必须勾选 `Add python.exe to PATH`。不需要安装 Docker，也不需要安装 Node.js。

## 演示顺序建议

1. 打开首页，先讲这是“基金渠道营销辅助系统”，不是面向散户的自动投资建议工具。
2. 展示分析前工作台：热点新闻、市场与基金配置参考、基金池结构、易方达官网基金超市对照。
3. 选择热点、渠道、风险偏好和基金类型。
4. 点击开始分析，展示 Agent 流程、候选基金、排除原因、字段来源和合规检查。
5. 进入基金详情页，展示渠道营销方案、客户经理话术、风险提示和技术依据折叠区。
6. 结尾强调：AI 负责初筛、解释和材料草稿，最终仍需要人工复核与合规审核。

## 常见问题

### 终端显示正在安装依赖

第一次运行是正常现象。等它完成后会自动启动服务。

### 页面能打开，但点击分析失败

大概率是没有配置 `DEEPSEEK_API_KEY`，或者网络无法访问 DeepSeek。让 Codex 检查 `.env` 和终端报错。

### 市场数据或官网基金超市为空

这些模块依赖公开网页接口。网络不可用或接口临时变化时，系统会显示空状态，不会编造数据。

### 端口被占用

脚本会自动尝试 `8000-8010`。如果全部被占用，让 Codex 关闭无关服务后重新运行脚本。

### 想重新同步基金池

答辩当天不建议临时同步。同步依赖外部接口，可能比较慢。确实需要时，让 Codex 在服务启动后运行：

```bash
curl -X POST http://127.0.0.1:8000/api/funds/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000, "enrich_limit": 500, "keywords": ["易方达"]}'
```

如果启动脚本使用的不是 `8000` 端口，把命令里的端口改成终端显示的端口。
