export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const windowSize = 2;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= windowSize) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="pagination">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} style={{ padding: "0 4px", color: "var(--ink-soft)" }}>…</span>
        ) : (
          <button key={p} className={p === page ? "active" : ""} onClick={() => onChange(p)}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
    </div>
  );
}
