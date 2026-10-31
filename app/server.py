"""Kittizen service. Local SQLite uses the standard library; hosted Postgres and Google auth are optional dependencies."""

import argparse, hashlib, hmac, json, math, os, re, secrets, sqlite3, time, subprocess, sys, threading
from functools import lru_cache, wraps
from contextlib import contextmanager
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from routing import plan_route, route_position
import database

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get("KITTIZEN_DB", ROOT / "storage/kittizen.sqlite"))
CATALOG = json.loads((ROOT / "public/catalog.json").read_text())
BODIES = {b["id"]: b for b in CATALOG["bodies"]}
GOOGLE_CLIENT_ID = os.environ.get("KITTIZEN_GOOGLE_CLIENT_ID", "")
TTL = 7200
CATALOG_REVISION = hashlib.sha256(
    (ROOT / "public/catalog.json").read_bytes()
).hexdigest()
UPDATE_STATUS = {"state": "idle", "message": "Watching installed game for patches"}


@lru_cache(maxsize=128)
def cached_plan(revision, origin, destination):
    return plan_route(BODIES, origin, destination)


def reload_catalog():
    global CATALOG, BODIES, CATALOG_REVISION
    raw = (ROOT / "public/catalog.json").read_bytes()
    revision = hashlib.sha256(raw).hexdigest()
    if revision != CATALOG_REVISION:
        catalog = json.loads(raw)
        CATALOG, BODIES, CATALOG_REVISION = (
            catalog,
            {b["id"]: b for b in catalog["bodies"]},
            revision,
        )


def game_watcher(game, stop):
    """One worker in this service; wait for two stable patch samples."""
    previous = None
    published = None
    while not stop.is_set():
        try:
            reload_catalog()
            p = game / "Data.p4k"
            st = p.stat()
            manifest = game / "build_manifest.id"
            signature = (
                st.st_size,
                st.st_mtime_ns,
                manifest.read_bytes() if manifest.exists() else b"",
            )
            if signature == previous and signature != published:
                UPDATE_STATUS.update(
                    state="extracting", message="Updating game catalogue and textures"
                )
                result = subprocess.run(
                    [
                        sys.executable,
                        str(ROOT / "scripts/update_game_data.py"),
                        "--game",
                        str(game),
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=300,
                )
                if result.returncode:
                    raise ValueError((result.stdout + result.stderr)[-1000:])
                reload_catalog()
                published = signature
                UPDATE_STATUS.update(state="ready", message="Game catalogue is current")
            elif signature != previous:
                UPDATE_STATUS.update(
                    state="waiting",
                    message="Waiting for game files to settle after a patch",
                )
            previous = signature
        except (OSError, ValueError, subprocess.TimeoutExpired) as e:
            UPDATE_STATUS.update(state="error", message=str(e)[-1000:])
        stop.wait(30)


@contextmanager
def connect():
    url = os.environ.get("KITTIZEN_DATABASE_URL", "")
    if url:
        with database.connect(url) as db:
            yield db
        return
    if os.environ.get("VERCEL"):
        raise RuntimeError("Hosted database is not configured")
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def init():
    if os.environ.get("KITTIZEN_DATABASE_URL"):
        raise RuntimeError("Initialize Postgres using scripts/init_postgres.py before starting the service")
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript("""PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT UNIQUE COLLATE NOCASE,salt TEXT,password TEXT,created REAL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT REFERENCES users(id),expires REAL);
        CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,user TEXT REFERENCES users(id),shard TEXT,kind TEXT,notes TEXT,location TEXT,position TEXT,route TEXT,created REAL);
        CREATE INDEX IF NOT EXISTS reports_shard ON reports(shard,created);
        CREATE TABLE IF NOT EXISTS votes(report TEXT REFERENCES reports(id),user TEXT REFERENCES users(id),value INTEGER,created REAL,PRIMARY KEY(report,user));
        CREATE TABLE IF NOT EXISTS identities(subject TEXT PRIMARY KEY,user TEXT UNIQUE REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS auth_challenges(nonce TEXT PRIMARY KEY,expires REAL);
        CREATE TABLE IF NOT EXISTS routes(id TEXT PRIMARY KEY,user TEXT REFERENCES users(id),name TEXT,origin TEXT,destination TEXT,created REAL);
        """)
        columns = {r["name"] for r in db.execute("PRAGMA table_info(reports)")}
        for name, definition in [
            ("system", "TEXT DEFAULT 'stanton'"),
            ("location_id", "TEXT"),
        ]:
            if name not in columns:
                db.execute(f"ALTER TABLE reports ADD COLUMN {name} {definition}")


def trust(db, uid, now=None):
    now = now or time.time()
    rows = db.execute(
        "SELECT v.user,v.value,v.created FROM votes v JOIN reports r ON r.id=v.report WHERE r.user=?",
        (uid,),
    ).fetchall()
    # One contribution per verifier across the account: repeat confirmations cannot farm trust.
    latest = {}
    for v in rows:
        if v["user"] not in latest or v["created"] > latest[v["user"]]["created"]:
            latest[v["user"]] = v
    good = sum(
        2 ** (-max(0, now - v["created"]) / (7 * 86400))
        for v in latest.values()
        if v["value"] == 1
    )
    bad = sum(
        2 ** (-max(0, now - v["created"]) / (7 * 86400))
        for v in latest.values()
        if v["value"] == -1
    )
    score = round(100 * good / (good + bad + 4))
    return dict(
        score=score,
        verifiers=len(latest),
        lastVerified=max(
            (v["created"] for v in latest.values() if v["value"] == 1), default=None
        ),
        tier=(
            "Trusted"
            if score >= 70 and good >= 10
            else "Established" if score >= 40 else "Unproven"
        ),
    )


def profile(db, handle, viewer=None):
    row = db.execute("SELECT id,handle,created FROM users WHERE LOWER(handle)=LOWER(?)", (handle,)).fetchone()
    if not row:
        return None
    uid, now = row["id"], time.time()
    stats = dict(db.execute("SELECT COUNT(*) AS reports, SUM(CASE WHEN created>? THEN 1 ELSE 0 END) AS active FROM reports WHERE user=?", (now-TTL,uid)).fetchone())
    stats["active"] = stats["active"] or 0
    stats.update(dict(db.execute("SELECT COALESCE(SUM(CASE WHEN v.value=1 THEN 1 ELSE 0 END),0) AS confirmations, COALESCE(SUM(CASE WHEN v.value=-1 THEN 1 ELSE 0 END),0) AS disputes FROM votes v JOIN reports r ON r.id=v.report WHERE r.user=?", (uid,)).fetchone()))
    stats["verificationsGiven"] = db.execute("SELECT COUNT(*) FROM votes WHERE user=?", (uid,)).fetchone()[0]
    own = bool(viewer and viewer["id"] == uid)
    history = []
    if own:
        for report in db.execute("SELECT id,kind,shard,location,system,created FROM reports WHERE user=? ORDER BY created DESC LIMIT 50", (uid,)):
            item = dict(report)
            item.update(dict(db.execute("SELECT COALESCE(SUM(CASE WHEN value=1 THEN 1 ELSE 0 END),0) AS confirmations, COALESCE(SUM(CASE WHEN value=-1 THEN 1 ELSE 0 END),0) AS disputes, MAX(CASE WHEN value=1 THEN created END) AS lastVerified FROM votes WHERE report=?", (report["id"],)).fetchone()))
            item["active"] = report["created"] > now-TTL
            history.append(item)
    return dict(handle=row["handle"],created=row["created"],own=own,trust=trust(db,uid),stats=stats,history=history,googleLinked=bool(own and db.execute("SELECT 1 FROM identities WHERE user=?", (uid,)).fetchone()))


def verify_google(credential, nonce):
    if not GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured yet")
    try:
        from google.oauth2 import id_token
        from google.auth.transport.requests import Request
    except ImportError:
        raise ValueError("Google sign-in dependency is not installed")
    try:
        claims = id_token.verify_oauth2_token(credential, Request(), GOOGLE_CLIENT_ID)
    except Exception:
        raise ValueError("Google could not verify this sign-in. Please try again.")
    if not claims.get("sub") or not hmac.compare_digest(str(claims.get("nonce", "")), nonce):
        raise ValueError("Google sign-in expired. Please reopen sign-in and try again.")
    # Privacy boundary: never persist or return the token, email, name, or picture.
    subject = claims["sub"]
    if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
        raise ValueError("Google could not verify this sign-in. Please try again.")
    return subject


def text(value, limit):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= limit:
        raise ValueError("Please check the required fields.")
    return value.strip()


def shard(value):
    value = text(value, 100).upper()
    if not re.fullmatch(r"(?:US|EU|AUS|ASIA)-[0-9]{3}", value):
        raise ValueError(
            "Choose US, EU, AUS or ASIA and enter a three-digit shard number (for example EU-001)."
        )
    return value


def request_cookies(header):
    """Parse our cookies independently of third-party cookies such as Google's g_state."""
    owned = SimpleCookie()
    seen = set()
    for part in header.split(';'):
        name = part.strip().partition('=')[0]
        if name not in ('session', 'google_nonce'):
            continue
        if name in seen:
            owned.pop(name, None)
            continue
        seen.add(name)
        parsed = SimpleCookie()
        parsed.load(part.strip())
        if name in parsed:
            owned[name] = parsed[name].value
    return owned


def committed_response(method):
    """Send JSON only after the request transaction has committed successfully."""
    @wraps(method)
    def wrapped(self):
        self._defer_json = True
        self._pending_json = None
        try:
            method(self)
        except Exception as error:
            # Database/network failures must never include connection strings or SQL.
            print('Request failed:', type(error).__name__, 'SQLSTATE:', getattr(error, 'sqlstate', None), file=sys.stderr)
            detail = str(error).lower()
            categories = ('password authentication failed', 'tenant or user not found', 'could not translate host name', 'timeout expired', 'connection refused', 'invalid percent-encoded token', 'ssl connection')
            print('Connection category:', next((item for item in categories if item in detail), 'unclassified'), file=sys.stderr)
            self._pending_json = ({"error":"Service temporarily unavailable. Please retry."},503,None)
        finally:
            self._defer_json = False
        if self._pending_json is not None:
            data, status, cookie = self._pending_json
            self.reply(data,status,cookie)
    return wrapped


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, data, status=200, cookie=None):
        if getattr(self, "_defer_json", False):
            self._pending_json = (data, status, cookie)
            return
        raw = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def user(self, db):
        c = request_cookies(self.headers.get("Cookie", ""))
        token = c.get("session")
        return db.execute(
            "SELECT u.id,u.handle FROM users u JOIN sessions s ON s.user=u.id WHERE s.token=? AND s.expires>?",
            (
                hashlib.sha256(token.value.encode()).hexdigest() if token else "",
                time.time(),
            ),
        ).fetchone()

    @committed_response
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith("/api/"):
            try:
                with connect() as db:
                    u = self.user(db)
                    if url.path == "/api/status":
                        reload_catalog()
                        return self.reply(
                            dict(
                                revision=CATALOG_REVISION,
                                generation=CATALOG.get("generation"),
                                build=CATALOG["build"],
                                locations=len(BODIES),
                                update=UPDATE_STATUS,
                            )
                        )
                    if url.path == "/api/auth-config":
                        nonce = secrets.token_urlsafe(32)
                        db.execute("DELETE FROM auth_challenges WHERE expires<?", (time.time(),))
                        if GOOGLE_CLIENT_ID:
                            db.execute("INSERT INTO auth_challenges VALUES(?,?)", (nonce,time.time()+600))
                        return self.reply(dict(googleClientId=GOOGLE_CLIENT_ID,nonce=nonce if GOOGLE_CLIENT_ID else None),cookie=f"google_nonce={nonce}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600" + ("; Secure" if os.environ.get("KITTIZEN_SECURE_COOKIE")=="1" else ""))
                    if url.path == "/api/profile":
                        handle = text(parse_qs(url.query).get("handle", [u["handle"] if u else ""])[0],24)
                        result = profile(db,handle,u)
                        return self.reply(result if result else {"error":"Pilot not found"},200 if result else 404)
                    if url.path == "/api/me":
                        return self.reply(
                            dict(
                                user=dict(u) if u else None,
                                trust=trust(db, u["id"]) if u else None,
                            )
                        )
                    if url.path == "/api/routes":
                        return self.reply(
                            [
                                dict(r)
                                for r in db.execute(
                                    "SELECT * FROM routes WHERE user=? ORDER BY created DESC LIMIT 50",
                                    (u["id"] if u else "",),
                                )
                            ]
                        )
                    if url.path == "/api/reports":
                        s = shard(parse_qs(url.query).get("shard", [""])[0])
                        now = time.time()
                        result = []
                        for r in db.execute(
                            "SELECT r.*,u.handle FROM reports r JOIN users u ON u.id=r.user WHERE shard=? AND r.created>? ORDER BY created DESC LIMIT 200",
                            (s, now - TTL),
                        ):
                            item = dict(r)
                            item["locationId"] = r["location_id"]
                            if r["location_id"] in BODIES:
                                item["position"] = json.dumps(
                                    BODIES[r["location_id"]]["position"]
                                )
                            votes = db.execute(
                                "SELECT * FROM votes WHERE report=?", (r["id"],)
                            ).fetchall()
                            item.update(
                                position=json.loads(item["position"]),
                                route=json.loads(r["route"]) if r["route"] else None,
                                trust=trust(db, r["user"]),
                                confirmations=sum(v["value"] == 1 for v in votes),
                                disputes=sum(v["value"] == -1 for v in votes),
                                lastVerified=max(
                                    (v["created"] for v in votes if v["value"] == 1),
                                    default=None,
                                ),
                                myVote=next(
                                    (
                                        v["value"]
                                        for v in votes
                                        if u and v["user"] == u["id"]
                                    ),
                                    0,
                                ),
                            )
                            result.append(item)
                        return self.reply(result)
                    return self.reply({"error": "Not found"}, 404)
            except ValueError as e:
                return self.reply({"error": str(e)}, 400)
        path = (
            ROOT / "public" / url.path.lstrip("/")
            if url.path != "/"
            else ROOT / "public/index.html"
        )
        if (
            not path.resolve().is_relative_to((ROOT / "public").resolve())
            or not path.is_file()
        ):
            return self.reply({"error": "Not found"}, 404)
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header(
            "Content-Type",
            {
                ".html": "text/html; charset=utf-8",
                ".js": "text/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".png": "image/png",
            }.get(path.suffix, "application/octet-stream"),
        )
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' https://accounts.google.com/gsi/style; script-src 'self' https://accounts.google.com/gsi/client; img-src 'self' data:; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; frame-ancestors 'none'",
        )
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        self.send_header(
            "Cache-Control",
            (
                "public, max-age=31536000, immutable"
                if "game-assets" in path.parts
                else "no-store"
            ),
        )
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def new_session(self, db, uid, now):
        token = secrets.token_urlsafe(32)
        db.execute("DELETE FROM sessions WHERE expires<?", (now,))
        db.execute("INSERT INTO sessions VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(),uid,now+30*86400))
        return self.reply({"ok":True},cookie=f"session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000" + ("; Secure" if os.environ.get("KITTIZEN_SECURE_COOKIE")=="1" else ""))

    @committed_response
    def do_POST(self):
        try:
            if self.headers.get("Origin") and urlsplit(
                self.headers["Origin"]
            ).netloc != self.headers.get("Host"):
                return self.reply({"error": "Origin not allowed"}, 403)
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.reply({"error": "JSON required"}, 415)
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 8192:
                return self.reply({"error": "Request too large"}, 413)
            d = json.loads(self.rfile.read(size))
            path = urlsplit(self.path).path
            now = time.time()
            if not isinstance(d, dict):
                raise ValueError("Expected an object")
            with connect() as db:
                u = self.user(db)
                if path == "/api/google":
                    if not GOOGLE_CLIENT_ID:
                        raise ValueError("Google sign-in is not configured yet")
                    if not self.headers.get("Origin"):
                        return self.reply({"error":"Origin required"},403)
                    cookies = request_cookies(self.headers.get("Cookie", ""))
                    nonce = cookies["google_nonce"].value if "google_nonce" in cookies else ""
                    challenge = db.execute("SELECT 1 FROM auth_challenges WHERE nonce=? AND expires>?", (nonce,now)).fetchone()
                    if not challenge:
                        raise ValueError("Google sign-in expired. Please reopen sign-in.")
                    subject = verify_google(text(d.get("credential"),8000),nonce)
                    linked = db.execute("SELECT user FROM identities WHERE subject=?", (subject,)).fetchone()
                    if u:
                        if linked and linked["user"] != u["id"]:
                            raise ValueError("This Google account is already linked to another pilot")
                        uid = u["id"]
                    elif linked:
                        uid = linked["user"]
                    else:
                        uid = secrets.token_hex(16)
                        handle = "Pilot_" + secrets.token_hex(6)
                        db.execute("INSERT INTO users VALUES(?,?,?,?,?)",(uid,handle,"","",now))
                    if not linked:
                        db.execute("INSERT INTO identities VALUES(?,?)",(subject,uid))
                    db.execute("DELETE FROM auth_challenges WHERE nonce=?",(nonce,))
                    return self.new_session(db,uid,now)
                if path in ("/api/register", "/api/login"):
                    handle = text(d.get("handle"), 24)
                    password = text(d.get("password"), 128)
                    if (
                        not re.fullmatch(r"[A-Za-z0-9_-]{3,24}", handle)
                        or len(password) < 10
                    ):
                        raise ValueError(
                            "Use a 3–24 character handle and a password of at least 10 characters."
                        )
                    if path == "/api/register":
                        salt = secrets.token_hex(16)
                        uid = secrets.token_hex(16)
                        db.execute(
                            "INSERT INTO users VALUES(?,?,?,?,?)",
                            (
                                uid,
                                handle,
                                salt,
                                hashlib.pbkdf2_hmac(
                                    "sha256", password.encode(), salt.encode(), 600000
                                ).hex(),
                                now,
                            ),
                        )
                    else:
                        row = db.execute(
                            "SELECT * FROM users WHERE LOWER(handle)=LOWER(?)", (handle,)
                        ).fetchone()
                        if not row or not hmac.compare_digest(
                            row["password"],
                            hashlib.pbkdf2_hmac(
                                "sha256",
                                password.encode(),
                                row["salt"].encode(),
                                600000,
                            ).hex(),
                        ):
                            return self.reply(
                                {"error": "Invalid handle or password"}, 401
                            )
                        uid = row["id"]
                    return self.new_session(db,uid,now)
                if not u:
                    if path == "/api/plan":
                        return self.reply(
                            cached_plan(
                                CATALOG_REVISION, d.get("origin"), d.get("destination")
                            )
                        )
                    return self.reply({"error": "Sign in to contribute"}, 401)
                if path == "/api/profile":
                    handle = text(d.get("handle"),24)
                    if not re.fullmatch(r"[A-Za-z0-9_-]{3,24}",handle):
                        raise ValueError("Use a 3–24 character handle: letters, digits, underscores or dashes")
                    db.execute("UPDATE users SET handle=? WHERE id=?",(handle,u["id"]))
                    return self.reply({"ok":True})
                if path == "/api/plan":
                    return self.reply(
                        cached_plan(
                            CATALOG_REVISION, d.get("origin"), d.get("destination")
                        )
                    )
                if path == "/api/logout":
                    c = request_cookies(self.headers.get("Cookie", ""))
                    db.execute(
                        "DELETE FROM sessions WHERE token=?",
                        (hashlib.sha256(c["session"].value.encode()).hexdigest(),),
                    )
                    return self.reply(
                        {"ok": True},
                        cookie="session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
                    )
                if path == "/api/reports":
                    s = shard(d.get("shard"))
                    kind = d.get("kind")
                    if kind not in ("Interdiction", "Pirates", "Suspicious", "Clear"):
                        raise ValueError("Choose an activity type")
                    if (
                        db.execute(
                            "SELECT COUNT(*) FROM reports WHERE user=? AND created>?",
                            (u["id"], now - 60),
                        ).fetchone()[0]
                        >= 3
                    ):
                        return self.reply(
                            {"error": "Please wait a minute before reporting again"},
                            429,
                        )
                    loc = d.get("location")
                    route = d.get("route")
                    body = BODIES.get(loc)
                    if route:
                        a = BODIES.get(route.get("origin"))
                        b = BODIES.get(route.get("destination"))
                        t = route.get("fraction")
                        if (
                            not a
                            or not b
                            or a == b
                            or type(t) not in (float, int)
                            or not math.isfinite(t)
                            or not 0 <= t <= 1
                        ):
                            raise ValueError("Invalid jump segment")
                        plan = cached_plan(CATALOG_REVISION, a["id"], b["id"])
                        pos, system = route_position(plan, t)
                        distance = plan["totalDistance"] * t / 1000
                        loc = f"{a['name']} → {b['name']} · {distance:,.3f} km from departure"
                        route = dict(
                            origin=a["id"],
                            destination=b["id"],
                            fraction=t,
                            system=system,
                            version=2,
                        )
                    elif body:
                        pos = body["position"]
                        loc = body["name"]
                        system = body.get("system", "stanton")
                    else:
                        raise ValueError("Select a mapped location or jump segment")
                    notes = d.get("notes", "")
                    if not isinstance(notes, str) or len(notes) > 500:
                        raise ValueError("Notes must be under 500 characters")
                    rid = secrets.token_hex(12)
                    db.execute(
                        "INSERT INTO reports(id,user,shard,kind,notes,location,position,route,created) VALUES(?,?,?,?,?,?,?,?,?)",
                        (
                            rid,
                            u["id"],
                            s,
                            kind,
                            notes,
                            loc,
                            json.dumps(pos),
                            json.dumps(route) if route else None,
                            now,
                        ),
                    )
                    db.execute(
                        "UPDATE reports SET system=?,location_id=? WHERE id=?",
                        (system, body["id"] if body and not route else None, rid),
                    )
                    return self.reply({"id": rid}, 201)
                if path == "/api/vote":
                    report = db.execute(
                        "SELECT * FROM reports WHERE id=?", (d.get("report"),)
                    ).fetchone()
                    value = d.get("value")
                    if not report or report["created"] < now - TTL:
                        raise ValueError("Report has expired")
                    if report["user"] == u["id"]:
                        raise ValueError("You cannot verify your own report")
                    if type(value) != int or value not in (-1, 1):
                        raise ValueError("Invalid verification")
                    if db.execute(
                        "SELECT 1 FROM votes WHERE report=? AND user=?",
                        (report["id"], u["id"]),
                    ).fetchone():
                        raise ValueError("You have already verified this report")
                    db.execute(
                        "INSERT INTO votes VALUES(?,?,?,?)",
                        (report["id"], u["id"], value, now),
                    )
                    return self.reply({"ok": True})
                if path == "/api/routes":
                    a = d.get("origin")
                    b = d.get("destination")
                    if a not in BODIES or b not in BODIES or a == b:
                        raise ValueError("Choose two different locations")
                    if (
                        db.execute(
                            "SELECT COUNT(*) FROM routes WHERE user=?", (u["id"],)
                        ).fetchone()[0]
                        >= 50
                    ):
                        raise ValueError("Route library is full (50 routes)")
                    db.execute(
                        "INSERT INTO routes VALUES(?,?,?,?,?,?)",
                        (
                            secrets.token_hex(12),
                            u["id"],
                            text(d.get("name"), 80),
                            a,
                            b,
                            now,
                        ),
                    )
                    return self.reply({"ok": True}, 201)
                if path == "/api/routes/delete":
                    db.execute(
                        "DELETE FROM routes WHERE id=? AND user=?",
                        (d.get("id"), u["id"]),
                    )
                    return self.reply({"ok": True})
                return self.reply({"error": "Not found"}, 404)
        except sqlite3.IntegrityError:
            self.reply(
                {
                    "error": (
                        "That handle is already registered"
                        if path in ("/api/register", "/api/profile")
                        else "This action was already recorded"
                    )
                },
                409,
            )
        except (json.JSONDecodeError, TypeError, AttributeError, KeyError):
            self.reply(
                {"error": "Invalid request. Check the fields and try again."}, 400
            )
        except ValueError as e:
            self.reply({"error": str(e)}, 400)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8077)
    parser.add_argument(
        "--game",
        type=Path,
        default=Path(r"D:\Games\Roberts Space Industries\StarCitizen\LIVE"),
    )
    parser.add_argument("--no-game-watch", action="store_true")
    args = parser.parse_args()
    if not os.environ.get("KITTIZEN_DATABASE_URL"):
        init()
    print(f"Kittizen ready: http://{args.host}:{args.port}", flush=True)
    stop = threading.Event()
    if not args.no_game_watch and os.environ.get("KITTIZEN_GAME_WATCH") != "0":
        threading.Thread(
            target=game_watcher, args=(args.game, stop), daemon=True
        ).start()
    else:
        UPDATE_STATUS.update(
            state="disabled", message="Patch watcher disabled for this test service"
        )
    try:
        ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
    finally:
        stop.set()
