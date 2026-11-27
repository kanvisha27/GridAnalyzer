import pytest

from algorithms.graph import build_adjacency, connected_components, is_connected
from algorithms.linalg import SingularMatrixError, gauss_jordan_inverse, gaussian_solve, identity, mat_mul


def close(a, b, tol=1e-9):
    return abs(a - b) < tol


def test_gaussian_solve_known_system():
    x = gaussian_solve([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3])
    assert all(close(a, b) for a, b in zip(x, [2, 3, -1]))


def test_gaussian_solve_needs_pivoting():
    x = gaussian_solve([[0, 1], [1, 0]], [3, 4])
    assert all(close(a, b) for a, b in zip(x, [4, 3]))


def test_singular_detected():
    with pytest.raises(SingularMatrixError):
        gaussian_solve([[1, 2], [2, 4]], [1, 2])
    with pytest.raises(SingularMatrixError):
        gauss_jordan_inverse([[1, 2], [2, 4]])


def test_inverse_times_matrix_is_identity():
    a = [[4, 7, 2], [3, 6, 1], [2, 5, 3]]
    prod = mat_mul(a, gauss_jordan_inverse(a))
    eye = identity(3)
    assert all(close(prod[i][j], eye[i][j]) for i in range(3) for j in range(3))


def test_connectivity():
    lines = [{"id": "L1", "from_bus": "A", "to_bus": "B"}]
    adj = build_adjacency(["A", "B", "C"], lines)
    assert adj["A"] == [("B", "L1")]
    comps = connected_components(adj)
    assert sorted(map(sorted, comps)) == [["A", "B"], ["C"]]
    assert not is_connected(adj)
    adj2 = build_adjacency(["A", "B"], lines)
    assert is_connected(adj2)
