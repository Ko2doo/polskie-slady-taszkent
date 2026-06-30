#!/usr/bin/env python3
"""Minimal App Store Connect API client.
JWT (ES256) is signed via openssl; DER->raw conversion done in pure Python.
Usage:
  python3 asc.py GET /v1/apps
  python3 asc.py GET "/v1/apps?filter[bundleId]=com.github.polskiesladytaszkent"
  python3 asc.py POST /v1/... '<json body>'
  python3 asc.py PATCH /v1/... '<json body>'
"""
import base64, json, subprocess, sys, time, urllib.request, urllib.error, os

KEY_ID = "NGRH4W5H3A"
ISSUER_ID = "a9c52812-62a6-43be-b82d-d102889e30f6"
KEY_PATH = os.path.expanduser("~/.appstoreconnect/private_keys/AuthKey_NGRH4W5H3A.p8")
BASE = "https://api.appstoreconnect.com"  # placeholder, real host set below
BASE = "https://api.appstoreconnect.apple.com"

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def der_to_raw(der: bytes) -> bytes:
    # parse ASN.1 SEQUENCE { INTEGER r, INTEGER s } -> 32+32 bytes
    assert der[0] == 0x30
    # length
    i = 2
    if der[1] & 0x80:
        nlen = der[1] & 0x7f
        i = 2 + nlen
    def read_int(idx):
        assert der[idx] == 0x02
        ln = der[idx+1]
        val = der[idx+2: idx+2+ln]
        return val.lstrip(b"\x00").rjust(32, b"\x00"), idx+2+ln
    r, i = read_int(i)
    s, i = read_int(i)
    return r + s

def make_jwt() -> str:
    header = {"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}
    now = int(time.time())
    payload = {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"}
    signing_input = b64url(json.dumps(header, separators=(",", ":")).encode()) + "." + \
                    b64url(json.dumps(payload, separators=(",", ":")).encode())
    p = subprocess.run(["openssl", "dgst", "-sha256", "-sign", KEY_PATH],
                       input=signing_input.encode(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError("openssl sign failed: " + p.stderr.decode())
    raw = der_to_raw(p.stdout)
    return signing_input + "." + b64url(raw)

def request(method: str, path: str, body=None):
    url = path if path.startswith("http") else BASE + path
    data = None
    headers = {"Authorization": "Bearer " + make_jwt()}
    if body is not None:
        data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, txt
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

if __name__ == "__main__":
    method = sys.argv[1]
    path = sys.argv[2]
    body = sys.argv[3] if len(sys.argv) > 3 else None
    status, txt = request(method, path, body)
    print("HTTP", status)
    try:
        print(json.dumps(json.loads(txt), indent=2, ensure_ascii=False))
    except Exception:
        print(txt)
