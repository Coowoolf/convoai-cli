"""
ConvoAI Starter — Python Server (FastAPI)
Alternative to the Node.js server. Same API routes, same frontend.

Usage:
    pip install -r requirements.txt
    cp .env.example .env  # fill in credentials
    uvicorn app:app --port 3000
"""

import os
import time
import random

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from token_builder import build_token

load_dotenv()

app = FastAPI(title="ConvoAI Starter")

current_session: dict | None = None

BASE_URLS = {
    "global": "https://api.agora.io/api/conversational-ai-agent/v2/projects",
    "cn": "https://api.agora.io/cn/api/conversational-ai-agent/v2/projects",
}


def get_base_url() -> str:
    app_id = os.environ["AGORA_APP_ID"]
    region = os.environ.get("AGORA_REGION", "global")
    base = BASE_URLS.get(region, BASE_URLS["global"])
    return f"{base}/{app_id}"


def get_auth() -> tuple[str, str]:
    return os.environ["AGORA_CUSTOMER_ID"], os.environ["AGORA_CUSTOMER_SECRET"]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/session/start")
def session_start():
    global current_session

    if current_session:
        raise HTTPException(409, "Session already active. Stop it first.")

    app_id = os.environ["AGORA_APP_ID"]
    app_cert = os.environ["AGORA_APP_CERTIFICATE"]
    customer_id, customer_secret = get_auth()

    channel = f"session-{int(time.time()):x}"
    client_uid = random.randint(10000, 99999)
    agent_uid = 0

    agent_token = build_token(app_id, app_cert, channel, agent_uid)
    client_token = build_token(app_id, app_cert, channel, client_uid)

    body = {
        "name": "convoai-starter",
        "properties": {
            "channel": channel,
            "token": agent_token,
            "agent_rtc_uid": str(agent_uid),
            "remote_rtc_uids": [str(client_uid)],
            "llm": {
                "vendor": os.environ.get("LLM_VENDOR"),
                "api_key": os.environ.get("LLM_API_KEY"),
                "model": os.environ.get("LLM_MODEL"),
                "url": os.environ.get("LLM_URL") or None,
                "style": os.environ.get("LLM_STYLE") or None,
                "greeting_message": "Hello! How can I help you today?",
                "max_history": 20,
                "params": {
                    "model": os.environ.get("LLM_MODEL"),
                    "max_tokens": 512,
                    "temperature": 0.7,
                },
            },
            "tts": {
                "vendor": os.environ.get("TTS_VENDOR"),
                "params": {"key": os.environ.get("TTS_API_KEY")},
            },
            "asr": {
                "vendor": os.environ.get("ASR_VENDOR", "ares"),
                "language": os.environ.get("ASR_LANGUAGE", "en-US"),
            },
            "parameters": {"enable_metrics": True},
        },
    }

    url = f"{get_base_url()}/join"
    res = requests.post(url, json=body, auth=(customer_id, customer_secret))

    if not res.ok:
        raise HTTPException(res.status_code, f"ConvoAI API error: {res.text}")

    data = res.json()
    current_session = {"agentId": data["agent_id"], "channel": channel}

    return {
        "appId": app_id,
        "channel": channel,
        "token": client_token,
        "uid": client_uid,
        "agentId": data["agent_id"],
    }


@app.post("/session/stop")
def session_stop():
    global current_session

    if not current_session:
        raise HTTPException(404, "No active session")

    customer_id, customer_secret = get_auth()
    url = f"{get_base_url()}/agents/{current_session['agentId']}/leave"

    try:
        requests.post(url, json={}, auth=(customer_id, customer_secret))
    except Exception:
        pass

    current_session = None
    return {"status": "stopped"}


@app.post("/session/interrupt")
def session_interrupt():
    global current_session

    if not current_session:
        raise HTTPException(404, "No active session")

    customer_id, customer_secret = get_auth()
    url = f"{get_base_url()}/agents/{current_session['agentId']}/interrupt"

    try:
        requests.post(url, json={}, auth=(customer_id, customer_secret))
    except Exception:
        pass

    return {"status": "interrupted"}


@app.get("/token")
def get_token(channel: str = "", uid: int = 0):
    app_id = os.environ["AGORA_APP_ID"]
    app_cert = os.environ["AGORA_APP_CERTIFICATE"]
    ch = channel or f"ch-{int(time.time()):x}"
    token = build_token(app_id, app_cert, ch, uid)
    return {"token": token, "channel": ch, "uid": uid}


@app.get("/history")
def get_history(agentId: str = ""):
    if not agentId:
        raise HTTPException(400, "Missing agentId query parameter")

    customer_id, customer_secret = get_auth()
    url = f"{get_base_url()}/agents/{agentId}/history"

    try:
        res = requests.get(url, auth=(customer_id, customer_secret))
        if res.ok:
            return {"history": res.json().get("history", [])}
    except Exception:
        pass
    return {"history": []}


# ─── Agora RTC SDK from npm ────────────────────────────────────────────────
# Requires: npm install in the parent directory (for agora-rtc-sdk-ng)

from fastapi.responses import FileResponse
from pathlib import Path

_sdk_path = Path(__file__).parent.parent / "node_modules" / "agora-rtc-sdk-ng" / "AgoraRTC_N-production.js"


@app.get("/agora-sdk.js")
def agora_sdk():
    if _sdk_path.exists():
        return FileResponse(_sdk_path, media_type="application/javascript")
    raise HTTPException(
        404,
        "Agora SDK not found. Run 'npm install' in the parent directory first.",
    )


# Serve frontend — mount AFTER API routes
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
