"""Simplified DC power-flow engine (educational).

Conventions (all quantities per-unit on one common, user-chosen system base):
  * injection P_i = generation_i - demand_i   (positive = power enters the grid)
  * B_ii = sum of 1/x over lines at bus i ;  B_ij = -sum of 1/x over lines i-j
  * B theta = P  with theta_ref = 0 (row/column of the reference bus removed)
  * signed flow on a line from->to  =  (theta_from - theta_to) / x
    (positive means power flows from `from_bus` to `to_bus`)
  * loading % = |flow| / capacity * 100
"""

import copy
import math
from typing import List, Optional

from .graph import build_adjacency, connected_components
from .linalg import SingularMatrixError, gauss_jordan_inverse, gaussian_solve, mat_vec

BALANCE_TOL = 1e-6      # allowed |sum of injections| (per-unit)
WARNING_PCT = 80.0      # loading at/above this (but <= 100) is flagged "warning"
OVERLOAD_EPS = 1e-9


class GridError(Exception):
    """A user-facing problem with the grid data or the resulting equations."""

    def __init__(self, code: str, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


# ----------------------------------------------------------------- validation
def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate_grid(grid: dict) -> None:
    """Raise GridError for any invalid input. Never modifies the grid."""
    buses, lines, ref = grid["buses"], grid["lines"], grid["reference_bus"]
    if len(buses) < 2:
        raise GridError("invalid_grid", "A grid needs at least 2 buses.")
    ids = [b["id"] for b in buses]
    if len(set(ids)) != len(ids):
        raise GridError("duplicate_bus", "Bus IDs must be unique.")
    for b in buses:
        if not (_finite(b["generation"]) and b["generation"] >= 0):
            raise GridError("invalid_bus", f"Bus {b['id']}: generation must be a number >= 0.")
        if not (_finite(b["demand"]) and b["demand"] >= 0):
            raise GridError("invalid_bus", f"Bus {b['id']}: demand must be a number >= 0.")
    if ref not in ids:
        raise GridError("invalid_reference", f"Reference bus '{ref}' is not one of the buses.")
    if not lines:
        raise GridError("invalid_grid", "A grid needs at least 1 line.")
    line_ids = [ln["id"] for ln in lines]
    if len(set(line_ids)) != len(line_ids):
        raise GridError("duplicate_line", "Line IDs must be unique.")
    for ln in lines:
        if ln["from_bus"] not in ids or ln["to_bus"] not in ids:
            raise GridError("invalid_line", f"Line {ln['id']}: both endpoints must be existing buses.")
        if ln["from_bus"] == ln["to_bus"]:
            raise GridError("self_loop", f"Line {ln['id']} connects bus {ln['from_bus']} to itself.")
        if not (_finite(ln["reactance"]) and ln["reactance"] > 0):
            raise GridError("invalid_reactance", f"Line {ln['id']}: reactance must be a number > 0.")
        if not (_finite(ln["capacity"]) and ln["capacity"] > 0):
            raise GridError("invalid_capacity", f"Line {ln['id']}: capacity must be a number > 0.")
    imbalance = sum(b["generation"] - b["demand"] for b in buses)
    if abs(imbalance) > BALANCE_TOL:
        raise GridError(
            "unbalanced",
            f"Total generation and demand differ by {imbalance:+.6f} p.u. "
            "The DC model needs total net injection = 0. Edit the inputs so they balance.",
            {"imbalance": imbalance},
        )


# ------------------------------------------------------------ model building
def build_susceptance_matrix(bus_ids: List[str], lines: List[dict]) -> List[List[float]]:
    """Symmetric bus susceptance matrix B (parallel lines add up)."""
    index = {b: i for i, b in enumerate(bus_ids)}
    n = len(bus_ids)
    B = [[0.0] * n for _ in range(n)]
    for ln in lines:
        i, j = index[ln["from_bus"]], index[ln["to_bus"]]
        y = 1.0 / ln["reactance"]
        B[i][i] += y
        B[j][j] += y
        B[i][j] -= y
        B[j][i] -= y
    return B


def net_injections(buses: List[dict]) -> List[float]:
    """P_i = generation - demand."""
    return [b["generation"] - b["demand"] for b in buses]


def reduce_system(B, P, ref_index: int):
    """Delete row/column `ref_index` of B and entry `ref_index` of P."""
    keep = [i for i in range(len(B)) if i != ref_index]
    return [[B[i][j] for j in keep] for i in keep], [P[i] for i in keep], keep


def status_for(loading_pct: float) -> str:
    if loading_pct > 100.0 + OVERLOAD_EPS:
        return "overloaded"
    if loading_pct >= WARNING_PCT:
        return "warning"
    return "normal"


def merge_sort(items: list, key, reverse: bool = False) -> list:
    """Stable merge sort written from scratch (used to rank lines by loading)."""
    if len(items) <= 1:
        return items[:]
    mid = len(items) // 2
    left = merge_sort(items[:mid], key, reverse)
    right = merge_sort(items[mid:], key, reverse)
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        take_left = key(left[i]) >= key(right[j]) if reverse else key(left[i]) <= key(right[j])
        if take_left:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out


def _clean(x: float) -> float:
    return 0.0 if abs(x) < 1e-12 else x


# -------------------------------------------------------------------- solving
def solve_case(grid: dict) -> dict:
    """Solve one network. Raises GridError if disconnected or singular."""
    buses, lines, ref = grid["buses"], grid["lines"], grid["reference_bus"]
    bus_ids = [b["id"] for b in buses]
    names = {b["id"]: (b.get("name") or b["id"]) for b in buses}

    adj = build_adjacency(bus_ids, lines)
    comps = connected_components(adj)
    if len(comps) > 1:
        raise GridError(
            "disconnected",
            f"The network is split into {len(comps)} separate islands: "
            + "; ".join("{" + ", ".join(c) + "}" for c in comps)
            + ". Connect every bus with at least one path of lines.",
            {"components": comps},
        )

    B = build_susceptance_matrix(bus_ids, lines)
    P = net_injections(buses)
    ref_index = bus_ids.index(ref)
    B_red, P_red, keep = reduce_system(B, P, ref_index)
    non_ref_ids = [bus_ids[i] for i in keep]

    try:
        theta_red = gaussian_solve(B_red, P_red)       # primary method
        B_red_inv = gauss_jordan_inverse(B_red)        # educational display only
    except SingularMatrixError as exc:
        raise GridError("singular", f"The reduced susceptance matrix is singular ({exc})") from exc

    residual = max((abs(a - b) for a, b in zip(mat_vec(B_red, theta_red), P_red)), default=0.0)

    theta = {ref: 0.0}
    for bid, th in zip(non_ref_ids, theta_red):
        theta[bid] = th

    rows = []
    for ln in lines:
        flow = _clean((theta[ln["from_bus"]] - theta[ln["to_bus"]]) / ln["reactance"])
        absf = abs(flow)
        pct = absf / ln["capacity"] * 100.0
        if absf < 1e-9:
            direction = "no flow"
        elif flow > 0:
            direction = f"{ln['from_bus']} -> {ln['to_bus']}"
        else:
            direction = f"{ln['to_bus']} -> {ln['from_bus']}"
        rows.append({
            "line_id": ln["id"], "from_bus": ln["from_bus"], "to_bus": ln["to_bus"],
            "reactance": ln["reactance"], "signed_flow": flow, "abs_flow": absf,
            "direction": direction, "capacity": ln["capacity"],
            "loading_pct": pct, "status": status_for(pct),
        })
    rows = merge_sort(rows, key=lambda r: r["loading_pct"], reverse=True)

    total_gen = sum(b["generation"] for b in buses)
    total_dem = sum(b["demand"] for b in buses)
    return {
        "reference_bus": ref,
        "bus_ids": bus_ids,
        "non_reference_bus_ids": non_ref_ids,
        "b_matrix": B,
        "reduced_matrix": B_red,
        "reduced_inverse": B_red_inv,
        "injections": P,
        "reduced_injections": P_red,
        "angles": [{
            "bus_id": b, "name": names[b], "angle_rad": _clean(theta[b]),
            "angle_deg": _clean(math.degrees(theta[b])), "is_reference": b == ref,
        } for b in bus_ids],
        "lines": rows,
        "summary": {
            "total_generation": total_gen, "total_demand": total_dem,
            "imbalance": total_gen - total_dem,
            "overload_count": sum(1 for r in rows if r["status"] == "overloaded"),
            "warning_count": sum(1 for r in rows if r["status"] == "warning"),
            "max_loading_line": rows[0]["line_id"] if rows else None,
            "max_loading_pct": rows[0]["loading_pct"] if rows else 0.0,
        },
        "solver": "Gaussian elimination with partial pivoting",
        "residual": residual,
        "adjacency": {k: [f"{n} (via {lid})" for n, lid in v] for k, v in adj.items()},
        "connected": True,
    }


def analyze(grid: dict) -> dict:
    validate_grid(grid)
    return solve_case(grid)


def run_contingency(grid: dict, line_id: str) -> dict:
    """Remove `line_id` from a temporary copy, re-solve and compare with the base case."""
    validate_grid(grid)
    if line_id not in [ln["id"] for ln in grid["lines"]]:
        raise GridError("unknown_line", f"Line '{line_id}' does not exist in this grid.")
    base = solve_case(grid)

    temp = copy.deepcopy(grid)                       # the base grid is never mutated
    removed = next(ln for ln in temp["lines"] if ln["id"] == line_id)
    temp["lines"] = [ln for ln in temp["lines"] if ln["id"] != line_id]
    outage_info = {"line_id": line_id, "from_bus": removed["from_bus"], "to_bus": removed["to_bus"]}

    try:
        if not temp["lines"]:
            raise GridError("disconnected", "Removing the only line leaves every bus isolated.",
                            {"components": [[b["id"]] for b in temp["buses"]]})
        outage = solve_case(temp)
    except GridError as exc:
        if exc.code not in ("disconnected", "singular"):
            raise
        return {
            "line_id": line_id, "outage_line": outage_info, "islanded": True,
            "error_code": exc.code, "message": exc.message,
            "components": exc.details.get("components", []),
            "base": base, "outage": None, "comparison": [],
            "summary": {"overloads_before": base["summary"]["overload_count"], "overloads_after": None,
                        "new_overloads": [], "worst_line": None, "worst_loading_pct": None},
        }

    base_by_id = {r["line_id"]: r for r in base["lines"]}
    out_by_id = {r["line_id"]: r for r in outage["lines"]}
    comparison = []
    for lid, b in base_by_id.items():
        o = out_by_id.get(lid)
        comparison.append({
            "line_id": lid, "from_bus": b["from_bus"], "to_bus": b["to_bus"], "capacity": b["capacity"],
            "base_signed_flow": b["signed_flow"], "base_loading_pct": b["loading_pct"], "base_status": b["status"],
            "outage_signed_flow": o["signed_flow"] if o else 0.0,
            "outage_loading_pct": o["loading_pct"] if o else 0.0,
            "outage_status": o["status"] if o else "out",
            "delta_abs_flow": (o["abs_flow"] if o else 0.0) - b["abs_flow"],
            "is_outaged": o is None,
        })
    comparison = merge_sort(comparison, key=lambda r: r["outage_loading_pct"], reverse=True)

    before = {r["line_id"] for r in base["lines"] if r["status"] == "overloaded"}
    after = [r["line_id"] for r in outage["lines"] if r["status"] == "overloaded"]
    new = [lid for lid in after if lid not in before]
    worst = outage["lines"][0]
    message = (f"Outage of {line_id} solved. " +
               (f"{len(new)} line(s) become newly overloaded: {', '.join(new)}." if new
                else "No new overloads were created."))
    return {
        "line_id": line_id, "outage_line": outage_info, "islanded": False, "error_code": None,
        "message": message, "components": [], "base": base, "outage": outage, "comparison": comparison,
        "summary": {"overloads_before": len(before), "overloads_after": len(after), "new_overloads": new,
                    "worst_line": worst["line_id"], "worst_loading_pct": worst["loading_pct"]},
    }
