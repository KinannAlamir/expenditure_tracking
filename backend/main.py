"""FastAPI backend for the Expenditure Tracker web app."""

import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.pipeline import process_uploads

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Expenditure Tracker API", version="1.0.0")

# Allow the Vite dev server (port 5173) to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze(
    files: list[UploadFile] = File(...),
    use_llm: bool = Form(True),
) -> dict:
    """
    Upload one or more semicolon-delimited CSV files exported from a French bank.
    Returns categorized transactions plus summary statistics.
    """
    file_contents: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        file_contents.append((f.filename or "upload.csv", content))

    logger.info(
        f"Received {len(file_contents)} file(s), use_llm={use_llm}"
    )
    return process_uploads(file_contents, use_llm=use_llm)


# ---------------------------------------------------------------------------
# Serve the built frontend in production
# ---------------------------------------------------------------------------

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str) -> FileResponse:  # noqa: ARG001
        return FileResponse(str(FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
