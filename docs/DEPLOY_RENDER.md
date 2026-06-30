# Render 公网部署说明

这是当前项目最简单的公网演示部署方式。部署后，React 前端和 FastAPI 后端共用一个网址，答辩同学只需要打开 Render 给出的 URL。

## 部署内容

- 前端：Docker 构建时从 `frontend/` 执行 `npm run build`。
- 后端：FastAPI 应用 `backend/app/main.py`。
- 演示数据：`backend/app/data/funds.db`。
- 密钥：`DEEPSEEK_API_KEY` 在 Render 后台填写，不提交到 GitHub。

## 推送前确认

以下文件需要提交并推送到 GitHub：

```bash
Dockerfile
.dockerignore
render.yaml
backend/app/data/funds.db
```

`funds.db` 是为了答辩演示特意带上的本地基金池缓存。没有它，线上页面可以打开，但基金池会是空的，除非重新在线同步。

## Render 操作步骤

1. 把当前仓库 push 到 GitHub。
2. 打开 Render，选择 **New +** -> **Blueprint**。
3. 连接 GitHub 仓库 `lesterlxt/Project-A`。
4. 选择包含 `render.yaml` 的仓库根目录。
5. Render 提示填写 `DEEPSEEK_API_KEY` 时，粘贴 DeepSeek key。
6. 创建服务，等待第一次部署完成。
7. 打开 Render 生成的 `https://...onrender.com` 地址。
8. 检查下面三个地址：

```text
/api/health
/api/funds/status
/
```

## 注意事项

- 免费 Render 服务可能有冷启动，答辩前提前打开一次网址。
- 不要提交 `.env`。
- 如果点击“开始分析”失败，先检查 Render 的 Environment 里是否填了 `DEEPSEEK_API_KEY`。
- 如果基金池为空，检查 `backend/app/data/funds.db` 是否已经提交并推送。
