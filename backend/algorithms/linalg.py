"""Dense linear-algebra routines written from scratch with plain Python lists.

No NumPy / SciPy is used anywhere in this project. Matrices are lists of rows
(list[list[float]]) and vectors are list[float].
"""

from typing import List

Matrix = List[List[float]]
Vector = List[float]


class SingularMatrixError(Exception):
    """Raised when a matrix has no usable pivot, i.e. it is (numerically) singular."""


def identity(n: int) -> Matrix:
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def copy_matrix(a: Matrix) -> Matrix:
    return [row[:] for row in a]


def mat_vec(a: Matrix, x: Vector) -> Vector:
    """Matrix-vector product A x."""
    return [sum(a[i][j] * x[j] for j in range(len(x))) for i in range(len(a))]


def mat_mul(a: Matrix, b: Matrix) -> Matrix:
    """Matrix-matrix product A B (used for checks such as A * A^-1 = I)."""
    n, m, p = len(a), len(b), len(b[0])
    return [[sum(a[i][k] * b[k][j] for k in range(m)) for j in range(p)] for i in range(n)]


def _scale(a: Matrix) -> float:
    biggest = max((abs(v) for row in a for v in row), default=0.0)
    return biggest if biggest > 0 else 1.0


def gaussian_solve(a: Matrix, b: Vector, tol: float = 1e-12) -> Vector:
    """Solve A x = b by Gaussian elimination with partial pivoting.

    Partial pivoting picks the largest |entry| in the current column as pivot,
    which limits round-off growth. A pivot smaller than ``tol`` times the
    largest matrix entry means the system is singular.
    """
    n = len(a)
    if n == 0:
        return []
    if any(len(row) != n for row in a) or len(b) != n:
        raise ValueError("A must be square and b must have the same length as A.")

    limit = tol * _scale(a)
    aug = [a[i][:] + [b[i]] for i in range(n)]  # augmented matrix [A | b]

    for col in range(n):
        pivot_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot_row][col]) <= limit:
            raise SingularMatrixError(f"Zero pivot in column {col + 1}: the matrix is singular.")
        if pivot_row != col:
            aug[col], aug[pivot_row] = aug[pivot_row], aug[col]
        for r in range(col + 1, n):
            factor = aug[r][col] / aug[col][col]
            if factor != 0.0:
                for c in range(col, n + 1):
                    aug[r][c] -= factor * aug[col][c]

    x = [0.0] * n  # back substitution
    for i in range(n - 1, -1, -1):
        s = sum(aug[i][j] * x[j] for j in range(i + 1, n))
        x[i] = (aug[i][n] - s) / aug[i][i]
    return x


def gauss_jordan_inverse(a: Matrix, tol: float = 1e-12) -> Matrix:
    """Invert A with Gauss-Jordan elimination on [A | I], using partial pivoting."""
    n = len(a)
    if n == 0:
        return []
    if any(len(row) != n for row in a):
        raise ValueError("Only square matrices can be inverted.")

    limit = tol * _scale(a)
    eye = identity(n)
    aug = [a[i][:] + eye[i] for i in range(n)]

    for col in range(n):
        pivot_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot_row][col]) <= limit:
            raise SingularMatrixError(f"Zero pivot in column {col + 1}: the matrix is singular.")
        if pivot_row != col:
            aug[col], aug[pivot_row] = aug[pivot_row], aug[col]
        pivot = aug[col][col]
        aug[col] = [v / pivot for v in aug[col]]  # scale pivot row to make the pivot 1
        for r in range(n):
            if r != col and aug[r][col] != 0.0:
                factor = aug[r][col]
                aug[r] = [aug[r][c] - factor * aug[col][c] for c in range(2 * n)]

    return [row[n:] for row in aug]
