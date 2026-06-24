# Project A

AI热点驱动的基金智能选品与营销生成平台 MVP。

第一版目标：

- 输入市场热点和银行渠道
- 分析热点对应主题和行业
- 从模拟基金池中选出 Top N 产品
- 给出可解释分数拆解、推荐理由和风险提示
- 生成渠道营销文案
- 做基础合规检查

## 后端运行

DeepSeek API key 放在项目根目录 `env` 或 `.env`。热点分析和营销文案会直接调用 DeepSeek；如果没有配置 key 或 DeepSeek 调用失败，请求会失败，不会静默退回模拟结果。

```text
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

```bash
cd backend
conda run -n agent311 uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

打开 Swagger：

```text
http://127.0.0.1:8000/docs
```

测试接口：

```text
POST /api/run-campaign
```

模型状态：

```text
GET /api/llm-status
```

示例请求：

```json
{
  "hotspot": "AI算力",
  "channel": "招商银行",
  "top_k": 5
}
```

## 前端运行

```bash
cd frontend
npm install
npm run dev
```

打开工作台：

```text
http://127.0.0.1:5173
```
