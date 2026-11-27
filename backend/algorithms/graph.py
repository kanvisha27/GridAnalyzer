"""Graph utilities: adjacency lists and connectivity (BFS)."""

from collections import deque
from typing import Dict, List, Tuple

Adjacency = Dict[str, List[Tuple[str, str]]]  # bus -> [(neighbour bus, line id), ...]


def build_adjacency(bus_ids: List[str], lines: List[dict]) -> Adjacency:
    """Adjacency list; every bus is present even if it has no lines."""
    adj: Adjacency = {b: [] for b in bus_ids}
    for ln in lines:
        a, b = ln["from_bus"], ln["to_bus"]
        adj[a].append((b, ln["id"]))
        adj[b].append((a, ln["id"]))
    return adj


def connected_components(adj: Adjacency) -> List[List[str]]:
    """Breadth-first search from every unvisited bus; returns the list of components."""
    seen = set()
    components: List[List[str]] = []
    for start in adj:
        if start in seen:
            continue
        seen.add(start)
        queue = deque([start])
        comp = []
        while queue:
            node = queue.popleft()
            comp.append(node)
            for nxt, _line_id in adj[node]:
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        components.append(comp)
    return components


def is_connected(adj: Adjacency) -> bool:
    return len(connected_components(adj)) <= 1
