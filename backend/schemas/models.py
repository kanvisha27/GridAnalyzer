"""Pydantic request / response models."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Bus(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    name: str = Field(default="", max_length=80)
    generation: float = Field(default=0.0, ge=0, allow_inf_nan=False)
    demand: float = Field(default=0.0, ge=0, allow_inf_nan=False)


class Line(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    from_bus: str = Field(min_length=1)
    to_bus: str = Field(min_length=1)
    reactance: float = Field(gt=0, allow_inf_nan=False)
    capacity: float = Field(gt=0, allow_inf_nan=False)


class Grid(BaseModel):
    buses: List[Bus] = Field(min_length=2, max_length=10)
    lines: List[Line] = Field(min_length=1, max_length=60)
    reference_bus: str = Field(min_length=1)


class ContingencyRequest(BaseModel):
    grid: Grid
    line_id: str = Field(min_length=1)


class LineResult(BaseModel):
    line_id: str
    from_bus: str
    to_bus: str
    reactance: float
    signed_flow: float
    abs_flow: float
    direction: str
    capacity: float
    loading_pct: float
    status: str


class AngleResult(BaseModel):
    bus_id: str
    name: str
    angle_rad: float
    angle_deg: float
    is_reference: bool


class Summary(BaseModel):
    total_generation: float
    total_demand: float
    imbalance: float
    overload_count: int
    warning_count: int
    max_loading_line: Optional[str]
    max_loading_pct: float


class AnalysisResponse(BaseModel):
    reference_bus: str
    bus_ids: List[str]
    non_reference_bus_ids: List[str]
    b_matrix: List[List[float]]
    reduced_matrix: List[List[float]]
    reduced_inverse: List[List[float]]
    injections: List[float]
    reduced_injections: List[float]
    angles: List[AngleResult]
    lines: List[LineResult]
    summary: Summary
    solver: str
    residual: float
    adjacency: Dict[str, List[str]]
    connected: bool


class OutageLine(BaseModel):
    line_id: str
    from_bus: str
    to_bus: str


class ComparisonRow(BaseModel):
    line_id: str
    from_bus: str
    to_bus: str
    capacity: float
    base_signed_flow: float
    base_loading_pct: float
    base_status: str
    outage_signed_flow: float
    outage_loading_pct: float
    outage_status: str
    delta_abs_flow: float
    is_outaged: bool


class ContingencySummary(BaseModel):
    overloads_before: int
    overloads_after: Optional[int]
    new_overloads: List[str]
    worst_line: Optional[str]
    worst_loading_pct: Optional[float]


class ContingencyResponse(BaseModel):
    line_id: str
    outage_line: OutageLine
    islanded: bool
    error_code: Optional[str]
    message: str
    components: List[List[str]]
    base: AnalysisResponse
    outage: Optional[AnalysisResponse]
    comparison: List[ComparisonRow]
    summary: ContingencySummary
