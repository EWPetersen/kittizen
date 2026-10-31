import json, math, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from routing import plan_route, route_position, sphere_hit, obstruction, orbit_markers

CATALOG = json.loads(
    (Path(__file__).resolve().parents[1] / "public/catalog.json").read_text()
)
BODIES = {b["id"]: b for b in CATALOG["bodies"]}


def body(name):
    return next(b for b in BODIES.values() if b["name"] == name)


class RouteTests(unittest.TestCase):
    def test_surface_exit_uses_extracted_boundary(self):
        plan = plan_route(BODIES, body("New Babbage")["id"], body("Lorville")["id"])
        self.assertEqual(plan["legs"][0]["kind"], "local")
        radius = math.dist(plan["legs"][0]["end"], body("microTech")["position"])
        self.assertGreaterEqual(
            radius, body("microTech")["quantum"]["arrivalRadius"] - 0.001
        )
        self.assertEqual(plan["legs"][-1]["kind"], "local")

    def test_opposite_sides_detour_over_oms(self):
        sphere = dict(
            id="planet",
            name="Planet",
            kind="planet",
            radius=1000,
            position=[0, 0, 0],
            rotation=[1, 0, 0, 0],
            system="stanton",
            quantum={
                "obstructionRadius": 1100,
                "arrivalRadius": 1200,
                "subPointRadiusMultiplier": 1.5,
            },
        )
        a = dict(id="a", name="A", kind="poi", position=[1000, 0, 0], system="stanton")
        b = dict(id="b", name="B", kind="poi", position=[-1000, 0, 0], system="stanton")
        plan = plan_route({x["id"]: x for x in [sphere, a, b]}, "a", "b")
        self.assertTrue(any("OM-" in l["endName"] for l in plan["legs"]))
        for l in plan["legs"]:
            if l["kind"] == "quantum":
                self.assertFalse(sphere_hit(l["start"], l["end"], [0, 0, 0], 1100))

    def test_cross_system_route_has_reciprocal_tunnels(self):
        plan = plan_route(BODIES, body("New Babbage")["id"], body("Levski")["id"])
        self.assertEqual(plan["systems"], ["stanton", "pyro", "nyx"])
        self.assertEqual(sum(l["kind"] == "jump" for l in plan["legs"]), 2)
        self.assertTrue(
            all(l["distance"] == 0 for l in plan["legs"] if l["kind"] == "jump")
        )

    def test_actual_quantum_legs_avoid_every_extracted_obstruction(self):
        for a, b in [
            ("New Babbage", "Lorville"),
            ("New Babbage", "Levski"),
            ("Port Tressler", "Seraphim Station"),
        ]:
            plan = plan_route(BODIES, body(a)["id"], body(b)["id"])
            for l in plan["legs"]:
                if l["kind"] != "quantum":
                    continue
                for o in BODIES.values():
                    if (
                        o["system"] == l["system"]
                        and obstruction(o) > 1000
                        and (o.get("radius", 0) > 0 or o["kind"] == "star")
                    ):
                        self.assertFalse(
                            sphere_hit(
                                l["start"], l["end"], o["position"], obstruction(o)
                            ),
                            (a, b, o["name"]),
                        )

    def test_missing_gate_and_blocked_body_fail(self):
        with self.assertRaises(ValueError):
            plan_route(
                {k: v for k, v in BODIES.items() if v["kind"] != "gateway"},
                body("New Babbage")["id"],
                body("Levski")["id"],
            )
        with self.assertRaises(ValueError):
            plan_route(BODIES, body("Stanton")["id"], body("Hurston")["id"])

    def test_om_six_axes_have_derived_radius_and_unique_positions(self):
        m = body("microTech")
        markers = orbit_markers(m)
        self.assertEqual(len(markers), 6)
        self.assertEqual(len({tuple(p["position"]) for p in markers}), 6)
        radii = [math.dist(x["position"], m["position"]) for x in markers]
        self.assertLess(max(radii) - min(radii), 0.001)
        self.assertGreater(min(radii), obstruction(m))

    def test_report_fraction_always_in_a_real_flight_system(self):
        plan = plan_route(BODIES, body("New Babbage")["id"], body("Levski")["id"])
        seen = set()
        for f in [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]:
            position, system = route_position(plan, f)
            seen.add(system)
            self.assertEqual(len(position), 3)
            self.assertTrue(all(math.isfinite(v) for v in position))
        self.assertIn("stanton", seen)
        self.assertIn("nyx", seen)
        for f in [-1, 2, float("nan"), True]:
            with self.assertRaises(ValueError):
                route_position(plan, f)


if __name__ == "__main__":
    unittest.main()
