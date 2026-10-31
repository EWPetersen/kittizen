"""Real HTTP, SQLite and coordinate tests; all data lives in a temporary directory."""

import socket
import concurrent.futures, http.cookiejar, json, os, sqlite3, subprocess, sys, tempfile, time, unittest
import urllib.request, urllib.error
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.build_catalog import mul, rotate, build

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def database(path):
    if os.environ.get("KITTIZEN_TEST_POSTGRES"):
        import database as pg_database
        with pg_database.connect(os.environ["KITTIZEN_TEST_POSTGRES"]) as db:
            yield db
        return
    db = sqlite3.connect(path)
    try:
        with db:
            yield db
    finally:
        db.close()


class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.db = Path(cls.temp.name) / "test.sqlite"
        with socket.socket() as listener:
            listener.bind(('127.0.0.1',0))
            cls.port=listener.getsockname()[1]
        cls.proc = subprocess.Popen(
            [sys.executable, str(ROOT / "server.py"), "--port", str(cls.port)],
            env={**os.environ, "KITTIZEN_DB": str(cls.db), "KITTIZEN_GAME_WATCH": "0"},
            stdout=subprocess.PIPE,
        )
        cls.base = f"http://127.0.0.1:{cls.port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/me", timeout=0.3)
                break
            except OSError:
                time.sleep(0.05)
        else:
            raise RuntimeError("Test server did not start")
        cls.a = cls.client()
        cls.b = cls.client()
        cls.c = cls.client()
        cls.anon = cls.client()
        for client, handle in [
            (cls.a, "reporter"),
            (cls.b, "verifier"),
            (cls.c, "otherpilot"),
        ]:
            assert (
                cls.request(
                    client,
                    "register",
                    {"handle": handle, "password": "test-password-only"},
                )[0]
                == 200
            )
        cls.catalog = json.loads((ROOT / "public/catalog.json").read_text())
        cls.bodies = {b["name"]: b for b in cls.catalog["bodies"]}

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=5)
        cls.proc.stdout.close()
        cls.temp.cleanup()

    @staticmethod
    def client():
        return urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    @classmethod
    def request(cls, client, path, data=None, headers=None):
        req = urllib.request.Request(
            cls.base + "/api/" + path,
            data=json.dumps(data).encode() if data is not None else None,
            headers=headers
            or ({"Content-Type": "application/json"} if data is not None else {}),
        )
        try:
            with client.open(req, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def create(self, client=None, shard="US-001", **extra):
        # Tests bypass the report rate window for isolated independent scenarios.
        with database(self.db) as db:
            db.execute(
                'UPDATE reports SET created=created-61 WHERE user=(SELECT id FROM users WHERE handle=?)', ("reporter",)
            )
        status, data = self.request(
            client or self.a,
            "reports",
            dict(
                shard=shard,
                kind="Interdiction",
                location=self.bodies["Hurston"]["id"],
                **extra,
            ),
        )
        self.assertEqual(status, 201, data)
        return data["id"]

    def test_01_guest_and_accounts(self):
        self.assertIsNone(self.request(self.anon, "me")[1]["user"])

        self.assertEqual(self.request(self.anon, "reports", {})[0], 401)
        self.assertEqual(self.request(self.anon, "routes", {})[0], 401)
        self.assertEqual(self.request(self.anon, "vote", {})[0], 401)
        self.assertEqual(
            self.request(
                self.anon,
                "register",
                {"handle": "REPORTER", "password": "test-password-only"},
            )[0],
            409,
        )
        self.assertEqual(
            self.request(
                self.anon, "login", {"handle": "reporter", "password": "wrong-password"}
            )[0],
            401,
        )
        self.assertEqual(
            self.request(self.anon, "register", {"handle": "xx", "password": "short"})[
                0
            ],
            400,
        )
        self.assertEqual(
            self.request(
                self.anon,
                "login",
                {"handle": "REPORTER", "password": "test-password-only"},
            )[0],
            200,
        )
        self.assertEqual(self.request(self.anon, "logout", {})[0], 200)
        self.assertIsNone(self.request(self.anon, "me")[1]["user"])

    def test_surface_poi_and_om_report_coordinates(self):
        for index,name in enumerate(('New Babbage','Lorville','Jumptown','microTech OM-1')):
            client=self.client()
            self.assertEqual(self.request(client,'register',{'handle':'SurfaceQA_'+str(index),'password':'test-password-only'})[0],200)
            body=self.bodies[name]
            status,created=self.request(client,'reports',{'shard':'AUS-998','kind':'Suspicious','location':body['id']})
            self.assertEqual(status,201,created)
            row=next(r for r in self.request(client,'reports?shard=AUS-998')[1] if r['id']==created['id'])
            self.assertEqual(row['locationId'],body['id'])
            self.assertEqual(row['position'],body['position'])
            self.assertEqual(row['system'],body['system'])

    def test_02_shard_isolation_and_notes(self):
        rid = self.create(shard="us-001", notes="<script>alert(1)</script>")
        one = self.request(self.b, "reports?shard=US-001")[1]
        two = self.request(self.b, "reports?shard=US-002")[1]
        self.assertTrue(any(r["id"] == rid for r in one))
        self.assertFalse(any(r["id"] == rid for r in two))
        self.assertEqual(
            next(r for r in one if r["id"] == rid)["notes"], "<script>alert(1)</script>"
        )
        self.assertEqual(self.request(self.b, "reports?shard=%3Cbad%3E")[0], 400)

    def test_03_verification_and_trust(self):
        rid = self.create(shard="US-003")
        self.assertEqual(
            self.request(self.a, "vote", {"report": rid, "value": 1})[0], 400
        )
        self.assertEqual(
            self.request(self.b, "vote", {"report": rid, "value": 1})[0], 200
        )
        self.assertEqual(
            self.request(self.b, "vote", {"report": rid, "value": 1})[0], 400
        )
        r = self.request(self.b, "reports?shard=US-003")[1][0]
        self.assertEqual(r["confirmations"], 1)
        self.assertEqual(r["myVote"], 1)
        self.assertIsNotNone(r["lastVerified"])
        self.assertEqual(r["trust"]["score"], 20)
        second = self.create(shard="US-003")
        self.assertEqual(
            self.request(self.b, "vote", {"report": second, "value": 1})[0], 200
        )
        self.assertEqual(self.request(self.a, "me")[1]["trust"]["verifiers"], 1)
        self.assertEqual(
            self.request(self.c, "vote", {"report": rid, "value": -1})[0], 200
        )
        self.assertLess(self.request(self.a, "me")[1]["trust"]["score"], 20)
        with database(self.db) as db:
            db.execute("UPDATE votes SET created=created-604800")
        self.assertLess(self.request(self.a, "me")[1]["trust"]["score"], 17)

    def test_04_expiry(self):
        rid = self.create(shard="US-004")
        with database(self.db) as db:
            db.execute(
                "UPDATE reports SET created=? WHERE id=?", (time.time() - 7201, rid)
            )
        self.assertEqual(self.request(self.b, "reports?shard=US-004")[1], [])
        self.assertEqual(
            self.request(self.b, "vote", {"report": rid, "value": 1})[0], 400
        )

    def test_05_route_interpolation(self):
        a = self.bodies["Crusader"]
        b = self.bodies["Hurston"]
        status, plan = self.request(
            self.anon, "plan", {"origin": a["id"], "destination": b["id"]}
        )
        self.assertEqual(status, 200)
        for t in [0, 0.123, 1]:
            rid = self.create(
                shard="US-005",
                route={"origin": a["id"], "destination": b["id"], "fraction": t},
            )
            r = next(
                r
                for r in self.request(self.b, "reports?shard=US-005")[1]
                if r["id"] == rid
            )
            distance = t * plan["totalDistance"]
            legs = [
                l for l in plan["legs"] if l["kind"] != "jump" and l["distance"] > 0
            ]
            segment = next(
                (l for l in legs if distance <= l["offset"] + l["distance"]), legs[-1]
            )
            fraction = (distance - segment["offset"]) / segment["distance"]
            for got, x, y in zip(r["position"], segment["start"], segment["end"]):
                self.assertAlmostEqual(got, x + (y - x) * fraction, places=3)
            self.assertEqual(r["system"], segment["system"])
        for t in [-0.1, 1.1, float("nan"), float("inf"), "0.5", True]:
            self.assertEqual(
                self.request(
                    self.a,
                    "reports",
                    {
                        "shard": "US-005",
                        "kind": "Pirates",
                        "route": {
                            "origin": a["id"],
                            "destination": b["id"],
                            "fraction": t,
                        },
                    },
                )[0],
                400,
            )

    def test_06_saved_routes_and_ownership(self):
        route = {
            "origin": self.bodies["Crusader"]["id"],
            "destination": self.bodies["Hurston"]["id"],
            "name": "My jump",
        }
        self.assertEqual(self.request(self.a, "routes", route)[0], 201)
        r = self.request(self.a, "routes")[1][0]
        self.assertEqual(r["name"], "My jump")
        self.assertEqual(self.request(self.b, "routes")[1], [])
        self.request(self.b, "routes/delete", {"id": r["id"]})
        self.assertEqual(len(self.request(self.a, "routes")[1]), 1)
        self.request(self.a, "routes/delete", {"id": r["id"]})
        self.assertEqual(self.request(self.a, "routes")[1], [])
        self.assertEqual(
            self.request(self.a, "routes", {**route, "destination": route["origin"]})[
                0
            ],
            400,
        )

    def test_07_malformed_requests_and_security(self):
        for data in [
            [],
            None,
            "oops",
            {"shard": []},
            {"shard": "AB", "kind": "made up"},
            {"shard": "AB", "kind": "Pirates", "location": "fake"},
        ]:
            if data is None:
                continue
            self.assertEqual(self.request(self.a, "reports", data)[0], 400)
        self.assertEqual(
            self.request(
                self.a, "routes", {"origin": [], "destination": [], "name": "x"}
            )[0],
            400,
        )
        self.assertEqual(
            self.request(
                self.a,
                "logout",
                {},
                headers={
                    "Content-Type": "application/json",
                    "Origin": "https://evil.example",
                },
            )[0],
            403,
        )
        self.assertEqual(self.request(self.a, "reports", {"x": "x" * 9000})[0], 413)
        self.assertEqual(self.request(self.a, "missing", {})[0], 404)
        for path in ["/../server.py", "/storage/kittizen.sqlite", "/%2e%2e/server.py"]:
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(self.base + path)

    def test_08_catalogue_transforms(self):
        self.assertGreaterEqual(len(self.catalog["bodies"]), 500)
        self.assertEqual(
            sum(
                b["kind"] == "planet" and b["system"] == "stanton"
                for b in self.catalog["bodies"]
            ),
            4,
        )
        self.assertEqual(
            sum(
                b["kind"] == "moon" and b["system"] == "stanton"
                for b in self.catalog["bodies"]
            ),
            12,
        )
        self.assertEqual(
            {s["id"] for s in self.catalog["systems"]}, {"stanton", "pyro", "nyx"}
        )
        moon = self.bodies["Clio"]
        parent = self.bodies["microTech"]
        self.assertAlmostEqual(
            math_distance(moon["position"], parent["position"]),
            math_distance(moon["local"], [0, 0, 0]),
            places=4,
        )
        self.assertEqual(rotate((0, 0, 0, 1), (1, 2, 3)), (-1.0, -2.0, 3.0))
        self.assertTrue(
            all(
                all(isinstance(v, (int, float)) for v in b["position"])
                for b in self.catalog["bodies"]
            )
        )

    def test_09_concurrent_votes(self):
        rid = self.create(shard="US-006")
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            results = list(
                pool.map(
                    lambda _: self.request(self.b, "vote", {"report": rid, "value": 1})[
                        0
                    ],
                    range(4),
                )
            )
        self.assertEqual(results.count(200), 1)
        self.assertEqual(
            self.request(self.b, "reports?shard=US-006")[1][0]["confirmations"], 1
        )

    def test_10_persistence_and_auth_expiry(self):
        rid = self.create(shard="US-007")
        with database(self.db) as db:
            self.assertIsNotNone(
                db.execute("SELECT id FROM reports WHERE id=?", (rid,)).fetchone()
            )
            db.execute(
                'UPDATE sessions SET expires=0 WHERE user=(SELECT id FROM users WHERE handle=?)', ("otherpilot",)
            )
        self.assertIsNone(self.request(self.c, "me")[1]["user"])
        self.proc.terminate()
        self.proc.wait(timeout=5)
        self.proc.stdout.close()
        type(self).proc = subprocess.Popen(
            [sys.executable, str(ROOT / "server.py"), "--port", str(self.port)],
            env={**os.environ, "KITTIZEN_DB": str(self.db), "KITTIZEN_GAME_WATCH": "0"},
            stdout=subprocess.PIPE,
        )
        for _ in range(100):
            try:
                status, rows = self.request(self.a, "reports?shard=US-007")
                break
            except OSError:
                time.sleep(0.05)
        self.assertEqual(status, 200)
        self.assertTrue(any(r["id"] == rid for r in rows))
        self.assertIsNotNone(self.request(self.a, "me")[1]["user"])

    def test_11_report_rate_and_field_limits(self):
        body = self.bodies["Hurston"]["id"]
        for _ in range(3):
            self.assertEqual(
                self.request(
                    self.b,
                    "reports",
                    {"shard": "US-008", "kind": "Clear", "location": body},
                )[0],
                201,
            )
        self.assertEqual(
            self.request(
                self.b, "reports", {"shard": "US-008", "kind": "Clear", "location": body}
            )[0],
            429,
        )
        with database(self.db) as db:
            db.execute(
                'UPDATE reports SET created=created-61 WHERE user=(SELECT id FROM users WHERE handle=?)', ("reporter",)
            )
        self.assertEqual(
            self.request(
                self.a,
                "reports",
                {
                    "shard": "US-008",
                    "kind": "Clear",
                    "location": body,
                    "notes": "x" * 501,
                },
            )[0],
            400,
        )
        self.assertEqual(
            self.request(
                self.a,
                "reports",
                {"shard": "X" * 101, "kind": "Clear", "location": body},
            )[0],
            400,
        )

    def test_12_route_library_limit(self):
        route = {
            "origin": self.bodies["Crusader"]["id"],
            "destination": self.bodies["Hurston"]["id"],
            "name": "Saved",
        }
        for _ in range(50):
            self.assertEqual(self.request(self.a, "routes", route)[0], 201)
        self.assertEqual(self.request(self.a, "routes", route)[0], 400)
        self.assertEqual(len(self.request(self.a, "routes")[1]), 50)

    def test_13_report_window_is_bounded(self):
        with database(self.db) as db:
            uid = db.execute('SELECT id FROM users WHERE handle=?', ("reporter",)).fetchone()[
                0
            ]
            db.executemany(
                "INSERT INTO reports(id,user,shard,kind,notes,location,position,route,created) VALUES(?,?,?,?,?,?,?,?,?)",
                [
                    (
                        f"bulk{i}",
                        uid,
                        "US-009",
                        "Pirates",
                        "",
                        "Hurston",
                        "[0,0,0]",
                        None,
                        time.time() - i,
                    )
                    for i in range(250)
                ],
            )
        reports = self.request(self.a, "reports?shard=US-009")[1]
        self.assertEqual(len(reports), 200)
        self.assertEqual(reports[0]["id"], "bulk0")
        self.assertEqual(reports[-1]["id"], "bulk199")


def math_distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


if __name__ == "__main__":
    unittest.main(verbosity=2)

class ShardFormatTests(unittest.TestCase):
    def test_regions_and_three_digits(self):
        from server import shard
        for region in ['US','EU','AUS','ASIA']:
            for number in ['000','001','999']:
                self.assertEqual(shard(f' {region.lower()}-{number} '),f'{region}-{number}')
        for value in ['US-1','US-01','US-0001','USA-001','EU-abc','US-１２３','US-1.0','QA-SHARD2','001','EU-001-extra',None,123,[]]:
            with self.assertRaises(ValueError): shard(value)
