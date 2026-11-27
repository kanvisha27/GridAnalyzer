from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "service": "grid-analyzer-api", "version": "1.0.0"}
