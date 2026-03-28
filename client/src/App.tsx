import React, { useState } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const API_BASE = "http://localhost:8000";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pageWindowStart, setPageWindowStart] = useState<number>(1);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");

  const PAGE_WINDOW_SIZE = 10;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setSelectedPages([]);
      setNumPages(0);
      setFilePath("");
      setPreviewError(null);
      setDownloadError(null);
      setUploadError(null);
      // auto-upload immediately so the download button can be used
      uploadFile(selected);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPreviewError(null);
    setPageWindowStart(1);
  };

  const togglePage = (page: number) => {
    setSelectedPages((prev) =>
      prev.includes(page)
        ? prev.filter((p) => p !== page)
        : [...prev, page].sort((a, b) => a - b)
    );
  };

  const selectAll = () => {
    setSelectedPages(Array.from({ length: numPages }, (_, i) => i + 1));
  };

  const clearSelection = () => {
    setSelectedPages([]);
  };

  const applyRangeSelection = () => {
    const bounds = computeRangeBounds();
    if (!bounds) return;

    const range = Array.from(
      { length: bounds.end - bounds.start + 1 },
      (_, i) => bounds.start + i
    );
    setSelectedPages(range);
  };

  const uploadFile = async (fileToUpload?: File | null) => {
    const sourceFile = fileToUpload ?? file;
    if (!sourceFile) return;
    const formData = new FormData();
    formData.append("file", sourceFile);

    setUploadError(null);
    setUploading(true);
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setFilePath(res.data.filePath);
      setUploadError(null);
    } catch (err: any) {
      console.error("Upload error", err);
      let detail: string | null = null;

      if (err?.response) {
        const status = err.response.status;
        const data = err.response.data;
        if (data?.detail) {
          detail = `${status}: ${data.detail}`;
        } else if (typeof data === "string") {
          detail = `${status}: ${data}`;
        }
      }

      if (!detail) {
        if (typeof err?.message === "string" && err.message) {
          if (err.message === "Network Error") {
            detail = `Network error talking to ${API_BASE}/upload – backend is not reachable. Check that the FastAPI server is running on port 8000 (bash start.sh).`;
          } else {
            detail = err.message;
          }
        } else {
          detail = "Failed to upload PDF.";
        }
      }

      setUploadError(detail);
    } finally {
      setUploading(false);
    }
  };

  const processPdf = async () => {
    if (!filePath || selectedPages.length === 0) return;
    setDownloadError(null);
    setProcessing(true);
    try {
      const res = await axios.post(
        `${API_BASE}/process-pdf`,
        { filePath, pages: selectedPages },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "processed.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Process error", err);
      let detail: string | null = null;

      if (err?.response) {
        const status = err.response.status;
        const data = err.response.data;

        if (data instanceof Blob) {
          try {
            const text = await data.text();
            try {
              const parsed = JSON.parse(text);
              if (parsed?.detail) {
                detail = `${status}: ${parsed.detail}`;
              } else {
                detail = `${status}: ${text}`;
              }
            } catch {
              detail = `${status}: ${text}`;
            }
          } catch {
            // ignore blob read failure
          }
        } else if (data?.detail) {
          detail = `${status}: ${data.detail}`;
        }
      }

      if (!detail) {
        detail =
          (typeof err?.message === "string" && err.message) ||
          "Failed to process PDF.";
      }

      setDownloadError(detail);
    } finally {
      setProcessing(false);
    }
  };

  const fileUrl =
    file ||
    (filePath && filePath.split("/").pop()
      ? `${API_BASE}/uploads/${filePath.split("/").pop()}`
      : null);
  const computeRangeBounds = () => {
    if (!numPages) return null;
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (Number.isNaN(from) || Number.isNaN(to)) return null;

    const start = Math.max(1, Math.min(from, to));
    const end = Math.min(numPages, Math.max(from, to));
    if (start > end) return null;
    return { start, end };
  };

  const rangeBounds = computeRangeBounds();

  const pageWindow =
    numPages > 0
      ? rangeBounds
        ? Array.from(
            { length: rangeBounds.end - rangeBounds.start + 1 },
            (_, i) => rangeBounds.start + i
          )
        : Array.from(
            {
              length: Math.min(
                PAGE_WINDOW_SIZE,
                Math.max(numPages - pageWindowStart + 1, 0)
              ),
            },
            (_, i) => pageWindowStart + i
          )
      : [];

  const canPrevWindow = !rangeBounds && pageWindowStart > 1;
  const canNextWindow =
    !rangeBounds && pageWindowStart + PAGE_WINDOW_SIZE <= numPages;

  return (
    <div className="app-shell">
      <div className="app-card">
        <header className="app-header">
          <div className="title-block">
            <div className="title-badge">PC</div>
            <div className="title-text">
              <h1>PDF Cutter</h1>
              <p>Upload a PDF, pick your pages, get a clean export.</p>
            </div>
          </div>
          <div className="app-header-right">
            <div className="pill">FastAPI + React</div>
            <span>Client-only file preview, server-side PDF slicing.</span>
          </div>
        </header>

        <div className="layout">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">1. Upload PDF</div>
                <div className="panel-subtitle">
                  Drag in a file or pick from disk.
                </div>
              </div>
            </div>

            <div className="file-input">
              <input type="file" accept=".pdf" onChange={onFileChange} />
              <button
                className="btn btn-primary"
                onClick={() => uploadFile()}
                disabled={!file || uploading}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            <div className="hint">
              Maximize quality: export to PDF from your editor first, then upload here.
            </div>

            <div className="status-line">
              {file
                ? `Selected file: ${file.name}`
                : "No file selected yet."}
            </div>
            {uploadError && (
              <div className="status-line error">
                Upload error: {uploadError}
              </div>
            )}
            <div className="status-line">
              {filePath ? (
                <span className="status-pill">
                  <span className="status-dot" />
                  Ready to slice pages
                </span>
              ) : (
                "Upload to enable PDF slicing."
              )}
            </div>
          </section>

          <section className="panel preview-container">
            <div className="panel-header">
              <div>
                <div className="panel-title">2. Choose pages</div>
                <div className="panel-subtitle">
                  Click pages to toggle selection, then export.
                </div>
              </div>
              <div className="button-row">
                <button
                  className="btn btn-primary"
                  onClick={processPdf}
                  disabled={!filePath || selectedPages.length === 0 || processing}
                >
                  {processing
                    ? "Processing…"
                    : "Download selected pages as PDF"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={selectAll}
                  disabled={!numPages}
                >
                  Select all
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={clearSelection}
                  disabled={selectedPages.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="status-line">
              Selected pages:{" "}
              {selectedPages.length > 0
                ? selectedPages.join(", ")
                : "none yet"}
            </div>

            {downloadError && (
              <div className="status-line error">
                Download error: {downloadError}
              </div>
            )}

            <div className="status-line">
              Range:
              <input
                type="number"
                min={1}
                max={numPages || undefined}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                style={{ width: "3.2rem", marginLeft: "0.4rem" }}
              />
              <span style={{ margin: "0 0.3rem" }}>to</span>
              <input
                type="number"
                min={1}
                max={numPages || undefined}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                style={{ width: "3.2rem" }}
              />
              <button
                className="btn btn-ghost"
                style={{ marginLeft: "0.5rem" }}
                onClick={applyRangeSelection}
                disabled={!numPages}
              >
                Apply range
              </button>
            </div>

            {previewError && (
              <div className="status-line error">
                Preview error: {previewError}
              </div>
            )}

            {fileUrl && (
              <div className="page-grid">
                <Document
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(err: any) => {
                    console.error("PDF preview load error", err);
                    setPreviewError(
                      err?.message || "Failed to load PDF preview."
                    );
                  }}
                  onSourceError={(err: any) => {
                    console.error("PDF source error", err);
                    setPreviewError(
                      err?.message || "Failed to fetch PDF from server."
                    );
                  }}
                >
                  {pageWindow.map((pageNum) => (
                    <div
                      key={pageNum}
                      className={
                        "page-tile" +
                        (selectedPages.includes(pageNum) ? " selected" : "")
                      }
                      onClick={() => togglePage(pageNum)}
                    >
                      <Page pageNumber={pageNum} width={260} />
                      <div className="page-label">Page {pageNum}</div>
                    </div>
                  ))}
                </Document>
              </div>
            )}

            {numPages > PAGE_WINDOW_SIZE && (
              <div className="footer-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    setPageWindowStart((prev) =>
                      Math.max(1, prev - PAGE_WINDOW_SIZE)
                    )
                  }
                  disabled={!canPrevWindow}
                >
                  ‹ Previous pages
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    setPageWindowStart((prev) =>
                      Math.min(
                        Math.max(1, numPages - PAGE_WINDOW_SIZE + 1),
                        prev + PAGE_WINDOW_SIZE
                      )
                    )
                  }
                  disabled={!canNextWindow}
                  style={{ marginLeft: "0.5rem" }}
                >
                  Next pages ›
                </button>
              </div>
            )}

          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
