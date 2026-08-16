const SHAPES: { type: "circle" | "square" | "tri"; size: number; top: number; left: number; color: string }[] = [
  { type: "circle", size: 16, top: 2, left: 0, color: "var(--forest)" },
  { type: "circle", size: 24, top: 6, left: 22, color: "var(--gold)" },
  { type: "square", size: 16, top: 36, left: 4, color: "var(--ink)" },
  { type: "circle", size: 10, top: 52, left: 38, color: "var(--moss)" },
  { type: "tri", size: 22, top: 2, left: 62, color: "var(--gold)" },
  { type: "circle", size: 18, top: 30, left: 72, color: "var(--gold-soft)" },
  { type: "circle", size: 9, top: 62, left: 92, color: "var(--forest)" },
  { type: "square", size: 12, top: 8, left: 102, color: "var(--moss)" },
  { type: "circle", size: 28, top: 36, left: 114, color: "var(--forest)" },
];

// Shared marketing/illustration panel for every auth page (sign-in, signup,
// forgot/reset password) — same brand panel throughout, only the form side
// changes per page. Consistency here is deliberate, not laziness.
export default function AuthVisual() {
  return (
    <div className="auth-visual">
      <div className="auth-shapes">
        {SHAPES.map((s, i) => (
          <span
            key={i}
            className={s.type}
            style={
              s.type === "tri"
                ? { top: s.top, left: s.left, borderBottomColor: s.color }
                : { top: s.top, left: s.left, width: s.size, height: s.size, background: s.color }
            }
          />
        ))}
      </div>

      <div className="auth-hero">
        <div className="auth-hero-bars">
          <span style={{ height: "28%" }} />
          <span style={{ height: "42%" }} />
          <span style={{ height: "38%" }} />
          <span style={{ height: "60%" }} />
          <span style={{ height: "76%" }} />
          <span style={{ height: "100%" }} />
        </div>
        <div className="auth-hero-badge">
          <span className="dot" /> +7% every 30 days
        </div>
      </div>

      <div className="auth-visual-copy">
        <span className="auth-eyebrow">Daily savings, real growth</span>
        <h2>Save a little, every day.</h2>
        <p>
          Kiyemba Savings keeps your principal safe and locked for a year, while your interest
          compounds 7% every 30 days and stays withdrawable whenever you need it.
        </p>
      </div>
    </div>
  );
}
