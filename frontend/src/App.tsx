import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { ArrowDownToLine, Check, Database, FileSpreadsheet, FolderOpen, LoaderCircle, Upload, X } from "lucide-react";

type Ingestion = {
  ingestion_id: string;
  filename: string;
  row_count: number;
  columns: string[];
  parquet_path: string;
};

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Ingestion | null>(null);
  const [dragging, setDragging] = useState(false);

  const chooseFile = (candidate?: File) => {
    setError("");
    setResult(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Choose a CSV file to continue.");
      return;
    }
    if (candidate.size > 50 * 1024 * 1024) {
      setFile(null);
      setError("This file is larger than the 50 MiB limit.");
      return;
    }
    setFile(candidate);
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/ingestions", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "The CSV could not be processed.");
      setResult(payload as Ingestion);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The API could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Fieldnote home">
          <span className="brand-mark"><Database size={18} strokeWidth={2.1} /></span>
          <span>fieldnote<span className="brand-period">.</span></span>
        </a>
        <div className="local-indicator"><span />LOCAL WORKSPACE</div>
      </header>

      <section className="workspace" id="home">
        <aside className="rail" aria-label="Workspace navigation">
          <div className="rail-icon active" title="Ingest CSV"><Upload size={18} /></div>
          <div className="rail-icon" title="Local datasets"><FolderOpen size={18} /></div>
          <div className="rail-bottom"><span className="avatar">L</span></div>
        </aside>

        <div className="content">
          <div className="eyebrow"><span>DATA WORKSPACE</span><span className="eyebrow-rule" /></div>
          <div className="heading-row">
            <div>
              <h1>Bring your data<br /><em>into the field.</em></h1>
              <p className="intro">Turn a CSV into a clean, query-ready foundation.</p>
            </div>
            <div className="format-stamp"><span>INPUT</span><strong>.CSV</strong><span>OUTPUT</span><strong>.PARQUET</strong></div>
          </div>

          <div className={`drop-zone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleInput} hidden />
            {file ? (
              <div className="file-row">
                <div className="file-icon"><FileSpreadsheet size={22} /></div>
                <div className="file-details"><strong>{file.name}</strong><span>{formatBytes(file.size)} <i /> UTF-8 CSV</span></div>
                <button className="icon-button" type="button" aria-label="Remove selected file" title="Remove file" onClick={() => { setFile(null); setError(""); }}><X size={17} /></button>
              </div>
            ) : (
              <>
                <div className="upload-symbol"><Upload size={20} /></div>
                <h2>Drop a file to begin</h2>
                <p>or <button className="text-button" type="button" onClick={() => inputRef.current?.click()}>browse your files</button></p>
                <span className="drop-note">CSV FILES <b>·</b> UP TO 50 MB</span>
              </>
            )}
          </div>

          {error && <div className="notice error" role="alert"><X size={16} />{error}</div>}
          {result && <div className="notice success" role="status"><Check size={16} />Dataset created <span>{result.ingestion_id.slice(0, 8)}</span></div>}

          <div className="action-row">
            <div className="privacy-note"><span className="privacy-dot" />Files stay on this machine</div>
            <button className="primary-button" type="button" onClick={upload} disabled={!file || busy}>
              {busy ? <><LoaderCircle className="spin" size={17} /> Processing</> : <>Create dataset <ArrowDownToLine size={16} /></>}
            </button>
          </div>

          {result ? (
            <section className="result-panel" aria-live="polite">
              <div className="result-head"><span className="section-label">INGESTION COMPLETE</span><span className="result-id">ID {result.ingestion_id.slice(0, 8)}</span></div>
              <div className="result-grid">
                <div><span className="metric-label">SOURCE</span><strong>{result.filename}</strong></div>
                <div><span className="metric-label">ROWS</span><strong>{result.row_count.toLocaleString()}</strong></div>
                <div><span className="metric-label">COLUMNS</span><strong>{result.columns.length}</strong></div>
              </div>
              <div className="column-list"><span className="metric-label">SCHEMA</span>{result.columns.map((column) => <code key={column}>{column}</code>)}</div>
              <div className="path-row"><FolderOpen size={15} /><span>{result.parquet_path}</span></div>
            </section>
          ) : (
            <div className="process-strip">
              <div className="process-step"><span className="step-number">01</span><div><strong>Validate</strong><span>Check structure &amp; encoding</span></div></div>
              <span className="step-line" />
              <div className="process-step"><span className="step-number">02</span><div><strong>Preserve</strong><span>Keep the original CSV</span></div></div>
              <span className="step-line" />
              <div className="process-step"><span className="step-number">03</span><div><strong>Convert</strong><span>Write curated Parquet</span></div></div>
            </div>
          )}
          <footer className="footer"><span>FIELDNOTE / LOCAL DATA TOOLS</span><span>RAW <b>+</b> CURATED</span></footer>
        </div>
      </section>
    </main>
  );
}