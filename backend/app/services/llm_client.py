import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class LLMError(RuntimeError):
    pass


def _load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _env_value(name: str, default: str = "") -> str:
    if os.getenv(name):
        return os.getenv(name, "").strip()

    for path in (PROJECT_ROOT / "env", PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"):
        values = _load_env_file(path)
        if name in values:
            return values[name]

    return default


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if match is None:
            raise
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")
    return parsed


class DeepSeekClient:
    def __init__(self) -> None:
        self.api_key = _env_value("DEEPSEEK_API_KEY")
        self.base_url = _env_value("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
        self.model = _env_value("DEEPSEEK_MODEL", "deepseek-chat")
        self.timeout = float(_env_value("DEEPSEEK_TIMEOUT", "30"))

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        content = self.chat_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        return parse_json_object(content)

    def chat_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        response_format: dict[str, str] | None = None,
    ) -> str:
        if not self.is_configured:
            raise LLMError("DEEPSEEK_API_KEY is not configured")

        payload: dict[str, Any] = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if response_format:
            payload["response_format"] = response_format

        request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise LLMError(f"DeepSeek HTTP {exc.code}: {detail[:300]}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise LLMError(f"DeepSeek request failed: {exc}") from exc

        try:
            return response_payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("DeepSeek returned an unexpected response shape") from exc
