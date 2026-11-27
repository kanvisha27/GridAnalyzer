from fastapi import APIRouter

from algorithms.dcflow import analyze, run_contingency
from schemas.models import AnalysisResponse, ContingencyRequest, ContingencyResponse, Grid

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_grid(grid: Grid):
    """Stateless base-case DC power flow. Includes matrices for educational display."""
    return analyze(grid.model_dump())


@router.post("/contingency", response_model=ContingencyResponse)
def contingency(req: ContingencyRequest):
    """Simulate the outage of one line on a temporary copy and compare with the base case."""
    return run_contingency(req.grid.model_dump(), req.line_id)
