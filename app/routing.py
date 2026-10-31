"""Conservative quantum-route planner using extracted game boundary radii.

Six OM candidates follow each body's reference-frame axes. A visibility graph
keeps quantum legs outside obstruction spheres. Atmospheric/surface legs are
explicit local flight; jump tunnels connect reciprocal installed gates only.
This does not model ship fuel, drive range, server state or live planet phase.
"""

import heapq
import math
from collections import deque


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def mul(v, s):
    return [x * s for x in v]


def unit(v):
    size = math.hypot(*v)
    return mul(v, 1 / size) if size else [1, 0, 0]


def rotate(q, v):
    w, x, y, z = q or [1, 0, 0, 0]
    n = math.hypot(w, x, y, z)
    w /= n
    x /= n
    y /= n
    z /= n
    a, b, c = v
    tx = 2 * (y * c - z * b)
    ty = 2 * (z * a - x * c)
    tz = 2 * (x * b - y * a)
    return [
        a + w * tx + y * tz - z * ty,
        b + w * ty + z * tx - x * tz,
        c + w * tz + x * ty - y * tx,
    ]


def sphere_hit(a, b, center, radius):
    v = sub(b, a)
    length = sum(x * x for x in v)
    t = (
        max(0, min(1, sum(x * y for x, y in zip(sub(center, a), v)) / length))
        if length
        else 0
    )
    return math.dist(add(a, mul(v, t)), center) < radius * (1 - 1e-7)


def obstruction(body):
    return max(
        body.get("radius", 0), body.get("quantum", {}).get("obstructionRadius", 0)
    )


def orbit_radius(body):
    q = body.get("quantum", {})
    r = obstruction(body)
    return max(
        r * 1.5, q.get("arrivalRadius", r) * q.get("subPointRadiusMultiplier", 1.5)
    )


def orbit_markers(body):
    r = orbit_radius(body)
    if r <= 0:
        return []
    axes = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]]
    return [
        dict(
            name=f'{body["name"]} OM-{i+1}',
            position=add(body["position"], mul(rotate(body.get("rotation"), axis), r)),
            system=body.get("system", "stanton"),
            kind="om",
        )
        for i, axis in enumerate(axes)
    ]


def gate_links(bodies):
    gates = [b for b in bodies.values() if b["kind"] == "gateway"]
    return [
        (a, b)
        for a in gates
        for b in gates
        if a.get("destinationSystem") == b.get("system")
        and b.get("destinationSystem") == a.get("system")
    ]


def endpoint(body, other, obstacles):
    p = body["position"]
    own = next((o for o in obstacles if o["id"] == body["id"]), None)
    if own:
        r = max(
            obstruction(own) * 1.001, own.get("quantum", {}).get("arrivalRadius", 0)
        )
        return (
            dict(
                name=body["name"] + " arrival boundary",
                position=add(p, mul(unit(sub(other, p)), r)),
                system=body.get("system", "stanton"),
            ),
            None,
        )
    inside = next(
        (o for o in obstacles if math.dist(p, o["position"]) < obstruction(o) * 1.001),
        None,
    )
    if inside:
        r = max(
            obstruction(inside) * 1.001,
            inside.get("quantum", {}).get("arrivalRadius", 0),
        )
        boundary = dict(
            name=inside["name"] + " QT exit boundary",
            position=add(inside["position"], mul(unit(sub(p, inside["position"])), r)),
            system=body.get("system", "stanton"),
        )
        return boundary, dict(
            name=body["name"], position=p, system=body.get("system", "stanton")
        )
    return (
        dict(name=body["name"], position=p, system=body.get("system", "stanton")),
        None,
    )


def leg(a, b, kind="quantum"):
    return dict(
        start=a["position"],
        end=b["position"],
        startName=a["name"],
        endName=b["name"],
        system=a["system"],
        kind=kind,
        distance=math.dist(a["position"], b["position"]),
    )


def local_plan(bodies, a, b):
    system = a.get("system", "stanton")
    obstacles = [
        o
        for o in bodies.values()
        if o.get("system", "stanton") == system
        and obstruction(o) > 1000
        and (o.get("radius", 0) > 0 or o["kind"] == "star")
    ]
    start, departure = endpoint(a, b["position"], obstacles)
    end, arrival = endpoint(b, a["position"], obstacles)

    def clear(x, y):
        return not any(
            sphere_hit(x["position"], y["position"], o["position"], obstruction(o))
            for o in obstacles
        )

    if clear(start, end):
        path = [start, end]
    else:
        nodes = [start, end] + [m for o in obstacles for m in orbit_markers(o)]
        cost = {0: 0}
        previous = {}
        queue = [(0, 0)]
        visited = set()
        while queue:
            distance, index = heapq.heappop(queue)
            if index in visited:
                continue
            visited.add(index)
            if index == 1:
                break
            for j, node in enumerate(nodes):
                if j in visited or j == index or not clear(nodes[index], node):
                    continue
                candidate = distance + math.dist(
                    nodes[index]["position"], node["position"]
                )
                if candidate < cost.get(j, float("inf")):
                    cost[j] = candidate
                    previous[j] = index
                    heapq.heappush(queue, (candidate, j))
        if 1 not in visited:
            raise ValueError(
                "No clear quantum route found for the extracted boundaries"
            )
        indices = [1]
        while indices[-1] != 0:
            indices.append(previous[indices[-1]])
        path = [nodes[i] for i in reversed(indices)]
    result = []
    if departure:
        result.append(leg(departure, start, "local"))
    result.extend(
        leg(x, y)
        for x, y in zip(path, path[1:])
        if math.dist(x["position"], y["position"]) > 0.01
    )
    if arrival:
        result.append(leg(end, arrival, "local"))
    return result


def plan_route(bodies, origin, destination):
    a = bodies.get(origin)
    b = bodies.get(destination)
    if not a or not b or a["id"] == b["id"]:
        raise ValueError("Choose two different mapped locations")
    if any(not x.get("jumpable", True) and x["kind"] != "gateway" for x in (a, b)):
        raise ValueError(
            "This destination is blocked for quantum travel in the game data"
        )
    start = a.get("system", "stanton")
    finish = b.get("system", "stanton")
    links = gate_links(bodies)
    chain = []
    if start != finish:
        queue = deque([(start, [])])
        seen = {start}
        while queue:
            system, path = queue.popleft()
            if system == finish:
                chain = path
                break
            for left, right in links:
                if left["system"] == system and right["system"] not in seen:
                    seen.add(right["system"])
                    queue.append((right["system"], path + [(left, right)]))
        if not chain:
            raise ValueError(
                "No reciprocal jump-gate connection to that system exists in this installation"
            )
    legs = []
    current = a
    for left, right in chain:
        if current["id"] != left["id"]:
            legs.extend(local_plan(bodies, current, left))
        legs.append(
            dict(
                kind="jump",
                system=left["system"],
                toSystem=right["system"],
                start=left["position"],
                end=right["position"],
                startName=left["name"],
                endName=right["name"],
                distance=0,
            )
        )
        current = right
    if current["id"] != b["id"]:
        legs.extend(local_plan(bodies, current, b))
    total = 0
    for segment in legs:
        segment["offset"] = total
        total += segment["distance"]
    return dict(
        origin=origin,
        destination=destination,
        legs=legs,
        totalDistance=total,
        systems=[start] + [r["system"] for _, r in chain],
        notes=[
            "OM axis numbering and departure model are derived approximations; no fuel, drive or live server-state simulation."
        ],
    )


def route_position(plan, fraction):
    if (
        type(fraction) not in (float, int)
        or not math.isfinite(fraction)
        or not 0 <= fraction <= 1
    ):
        raise ValueError("Invalid route fraction")
    distance = fraction * plan["totalDistance"]
    segments = [l for l in plan["legs"] if l["kind"] != "jump" and l["distance"] > 0]
    if not segments:
        raise ValueError("This route has no reportable flight segment")
    selected = next(
        (l for l in segments if distance <= l["offset"] + l["distance"]), segments[-1]
    )
    t = max(0, min(1, (distance - selected["offset"]) / selected["distance"]))
    return (
        add(selected["start"], mul(sub(selected["end"], selected["start"]), t)),
        selected["system"],
    )
