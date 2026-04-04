"""
Agora AccessToken2 builder for RTC.
Pure Python implementation — no external Agora SDK dependency.
"""

import hmac
import hashlib
import struct
import base64
import time
import secrets

PRIVILEGE_JOIN_CHANNEL = 1
PRIVILEGE_PUBLISH_AUDIO = 2
PRIVILEGE_PUBLISH_VIDEO = 3
PRIVILEGE_PUBLISH_DATA = 4
SERVICE_TYPE_RTC = 1


def _pack_uint16(value: int) -> bytes:
    return struct.pack("<H", value)


def _pack_uint32(value: int) -> bytes:
    return struct.pack("<I", value)


def _pack_string(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return _pack_uint16(len(encoded)) + encoded


def _pack_map_uint32(m: dict[int, int]) -> bytes:
    result = _pack_uint16(len(m))
    for k, v in m.items():
        result += _pack_uint16(k) + _pack_uint32(v)
    return result


def _pack_service(service_type: int, privileges: dict[int, int]) -> bytes:
    return _pack_uint16(service_type) + _pack_map_uint32(privileges)


def build_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int,
    expire_seconds: int = 3600,
) -> str:
    """Build an AccessToken2 for RTC with PUBLISHER role."""
    now = int(time.time())
    expire = now + expire_seconds

    privileges = {
        PRIVILEGE_JOIN_CHANNEL: expire,
        PRIVILEGE_PUBLISH_AUDIO: expire,
        PRIVILEGE_PUBLISH_VIDEO: expire,
        PRIVILEGE_PUBLISH_DATA: expire,
    }

    service_data = _pack_service(SERVICE_TYPE_RTC, privileges)
    uid_str = str(uid) if uid > 0 else ""
    channel_data = _pack_string(channel_name) + _pack_string(uid_str)

    salt = secrets.randbelow(0xFFFFFFFF)
    ts = now

    message = _pack_uint32(salt) + _pack_uint32(ts) + _pack_uint16(1) + service_data
    signing_content = channel_data + message

    h1 = hmac.new(
        _pack_uint32(salt), app_certificate.encode("utf-8"), hashlib.sha256
    ).digest()
    h2 = hmac.new(h1, signing_content, hashlib.sha256).digest()

    sign_len = _pack_uint16(len(h2))
    token_content = sign_len + h2 + message

    version = "007"
    token_b64 = base64.b64encode(token_content).decode("utf-8")

    return f"{version}{app_id}{token_b64}"
