// Shared loading indicator — a small spinner for a panel/table that's
// mid-refresh, or the full-page branded variant for the moment before the
// dashboard shell itself has anything to show (session still resolving).
export function Loader({ full = false, label = "Loading…" }: { full?: boolean; label?: string }) {
  if (full) {
    return (
      <div className="loader-full">
        <div className="loader-mark">K</div>
        <div className="spinner" />
        <p>{label}</p>
      </div>
    );
  }
  return (
    <div className="loader-inline">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
