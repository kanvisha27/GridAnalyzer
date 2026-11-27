import copy

import pytest

from algorithms.dcflow import (GridError, analyze, build_susceptance_matrix, merge_sort, net_injections,
                               reduce_system, run_contingency, status_for, validate_grid)


def bus(i, g=0.0, d=0.0):
    return {"id": i, "name": i, "generation": g, "demand": d}


def line(i, a, b, x=0.1, cap=1.5):
    return {"id": i, "from_bus": a, "to_bus": b, "reactance": x, "capacity": cap}


def triangle(cap=1.5):
    """Gen 2 at B1; demand 1 at B2 and B3; identical x = 0.1 lines."""
    return {
        "buses": [bus("B1", 2.0), bus("B2", 0, 1.0), bus("B3", 0, 1.0)],
        "lines": [line("L12", "B1", "B2", cap=cap), line("L13", "B1", "B3", cap=cap), line("L23", "B2", "B3", cap=cap)],
        "reference_bus": "B1",
    }


def approx(a, b, tol=1e-9):
    return abs(a - b) < tol


def test_susceptance_matrix_symmetric_and_rows_sum_zero():
    g = triangle()
    B = build_susceptance_matrix([b["id"] for b in g["buses"]], g["lines"])
    assert approx(B[0][0], 20) and approx(B[0][1], -10) and approx(B[1][2], -10)
    for i in range(3):
        assert approx(sum(B[i]), 0)
        for j in range(3):
            assert approx(B[i][j], B[j][i])


def test_parallel_lines_add_susceptance():
    B = build_susceptance_matrix(["A", "B"], [line("L1", "A", "B", 0.1), line("L2", "A", "B", 0.2)])
    assert approx(B[0][1], -15) and approx(B[0][0], 15)


def test_injections_and_reduction():
    g = triangle()
    P = net_injections(g["buses"])
    assert P == [2.0, -1.0, -1.0]
    B = build_susceptance_matrix(["B1", "B2", "B3"], g["lines"])
    Br, Pr, keep = reduce_system(B, P, 1)
    assert keep == [0, 2] and Pr == [2.0, -1.0]
    assert len(Br) == 2 and approx(Br[0][1], B[0][2]) and approx(Br[1][1], B[2][2])


def test_two_bus_flow():
    g = {"buses": [bus("A", 1.0), bus("B", 0, 1.0)], "lines": [line("L", "A", "B", 0.1, 2.0)], "reference_bus": "A"}
    r = analyze(g)
    assert approx(r["angles"][1]["angle_rad"], -0.1)
    assert approx(r["lines"][0]["signed_flow"], 1.0)
    assert approx(r["lines"][0]["loading_pct"], 50.0)
    assert r["lines"][0]["direction"] == "A -> B"


def test_triangle_flows_and_residual():
    r = analyze(triangle())
    flows = {x["line_id"]: x["signed_flow"] for x in r["lines"]}
    assert approx(flows["L12"], 1.0) and approx(flows["L13"], 1.0) and approx(flows["L23"], 0.0)
    assert r["residual"] < 1e-9
    assert r["angles"][0]["is_reference"] and r["angles"][0]["angle_rad"] == 0.0


def test_reference_choice_does_not_change_flows():
    g = triangle()
    g2 = copy.deepcopy(g)
    g2["reference_bus"] = "B3"
    f1 = {x["line_id"]: x["signed_flow"] for x in analyze(g)["lines"]}
    f2 = {x["line_id"]: x["signed_flow"] for x in analyze(g2)["lines"]}
    assert all(approx(f1[k], f2[k]) for k in f1)


def test_overload_detection_and_sorting():
    r = analyze(triangle(cap=0.9))
    assert r["summary"]["overload_count"] == 2
    pcts = [x["loading_pct"] for x in r["lines"]]
    assert pcts == sorted(pcts, reverse=True)
    assert r["lines"][0]["status"] == "overloaded" and r["lines"][-1]["status"] == "normal"
    assert status_for(100.0) == "warning" and status_for(79.9) == "normal" and status_for(100.1) == "overloaded"


def test_merge_sort_stable_and_correct():
    items = [(3, "a"), (1, "b"), (3, "c"), (2, "d")]
    assert merge_sort(items, key=lambda t: t[0], reverse=True) == [(3, "a"), (3, "c"), (2, "d"), (1, "b")]
    assert merge_sort(items, key=lambda t: t[0]) == [(1, "b"), (2, "d"), (3, "a"), (3, "c")]


def test_validation_errors():
    g = triangle()
    bad = copy.deepcopy(g); bad["lines"][0]["reactance"] = 0
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "invalid_reactance"
    bad = copy.deepcopy(g); bad["lines"][0]["capacity"] = -1
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "invalid_capacity"
    bad = copy.deepcopy(g); bad["lines"][0]["to_bus"] = "B1"
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "self_loop"
    bad = copy.deepcopy(g); bad["lines"][0]["to_bus"] = "ZZ"
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "invalid_line"
    bad = copy.deepcopy(g); bad["reference_bus"] = "ZZ"
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "invalid_reference"
    bad = copy.deepcopy(g); bad["buses"][1]["id"] = "B1"
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "duplicate_bus"
    bad = copy.deepcopy(g); bad["lines"][1]["id"] = "L12"
    with pytest.raises(GridError) as e: validate_grid(bad)
    assert e.value.code == "duplicate_line"


def test_unbalanced_is_reported_not_fixed():
    g = triangle(); g["buses"][0]["generation"] = 3.0
    with pytest.raises(GridError) as e: analyze(g)
    assert e.value.code == "unbalanced"
    assert g["buses"][0]["generation"] == 3.0


def test_disconnected_base_grid():
    g = triangle()
    g["lines"] = [line("L12", "B1", "B2")]
    with pytest.raises(GridError) as e: analyze(g)
    assert e.value.code == "disconnected"
    assert sorted(map(sorted, e.value.details["components"])) == [["B1", "B2"], ["B3"]]


def test_contingency_redistributes_flow_and_keeps_base_untouched():
    g = triangle(cap=1.5)
    snapshot = copy.deepcopy(g)
    c = run_contingency(g, "L12")
    assert g == snapshot
    assert not c["islanded"]
    out = {r["line_id"]: r for r in c["outage"]["lines"]}
    assert approx(out["L13"]["signed_flow"], 2.0) and approx(out["L23"]["signed_flow"], -1.0)
    assert c["summary"]["new_overloads"] == ["L13"]
    row = next(r for r in c["comparison"] if r["line_id"] == "L12")
    assert row["is_outaged"] and row["outage_status"] == "out"


def test_contingency_islanding_reported():
    g = triangle()
    g["lines"] = [line("L12", "B1", "B2"), line("L23", "B2", "B3")]   # a chain
    c = run_contingency(g, "L23")
    assert c["islanded"] and c["outage"] is None and c["error_code"] == "disconnected"
    assert sorted(map(sorted, c["components"])) == [["B1", "B2"], ["B3"]]


def test_contingency_unknown_line():
    with pytest.raises(GridError) as e: run_contingency(triangle(), "NOPE")
    assert e.value.code == "unknown_line"
