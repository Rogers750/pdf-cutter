# PDF Cutter

A small web app for slicing PDFs into a new document containing only the pages you choose.  
Frontend is React + Vite; backend is FastAPI (Python) using `pypdf`.

## Features

- Upload a PDF from your machine (no DOCX, PDF only).
- Preview pages in a grid, click to select/deselect.
- Quickly select a range of pages using **From / To** inputs.
- Download a new PDF that contains only the selected pages.

## Project structure

- `server/` – FastAPI backend (`main.py`, `requirements.txt`, `uploads/`, `processed/`).
- `client/` – React + Vite frontend.
- `start.sh` – Convenience script to start backend + frontend together (using the virtualenv in `server/.venv`).

## Getting started

### 1. Backend (FastAPI)

```bash
cd server
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# run the API on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The main endpoints:

- `POST /upload` – multipart form with field `file` (PDF). Returns `{ "filePath": "<server-path>" }`.
- `POST /process-pdf` – JSON body: `{ "filePath": string, "pages": number[] }`, returns a sliced PDF file.

### 2. Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173` or `http://localhost:5174`).

### 3. One-shot dev startup

From the project root:

```bash
bash start.sh
```

This uses the existing virtualenv in `server/.venv` to start FastAPI on port `8000` and then runs the Vite dev server for the React client.

