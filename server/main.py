from pathlib import Path
from typing import List
import time

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pypdf import PdfReader, PdfWriter


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"

UPLOAD_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class ProcessRequest(BaseModel):
    filePath: str
    pages: List[int]


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    ts = int(time.time() * 1000)
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    dest_path = UPLOAD_DIR / f"{ts}-{safe_name}"

    data = await file.read()
    dest_path.write_bytes(data)

    # Client will use this path to preview and send back
    return {"filePath": str(dest_path)}


@app.post("/process-pdf")
async def process_pdf(body: ProcessRequest):
    if not body.filePath:
        raise HTTPException(status_code=400, detail="filePath is required.")

    src = Path(body.filePath)
    if not src.is_absolute():
        src = BASE_DIR / src

    if not src.exists():
        raise HTTPException(status_code=404, detail="Source PDF not found.")

    try:
        reader = PdfReader(str(src))
        writer = PdfWriter()

        num_pages = len(reader.pages)

        # Map requested 1-based page numbers into a safe, in-range, zero-based set
        indices = sorted(
            {
                p - 1
                for p in body.pages
                if isinstance(p, int) and 1 <= p <= num_pages
            }
        )
        # If, for some reason, nothing valid made it through (e.g. a weird
        # client state), fall back to keeping all pages instead of 400-ing.
        if not indices:
            indices = list(range(num_pages))

        for idx in indices:
            writer.add_page(reader.pages[idx])

        ts = int(time.time() * 1000)
        out_path = PROCESSED_DIR / f"processed-{ts}.pdf"
        with out_path.open("wb") as f:
            writer.write(f)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error processing PDF.")

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename="processed.pdf",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
