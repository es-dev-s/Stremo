import { hueFrom, initialsFrom } from "../lib/data";

export function AgentAvatar({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  const hue = hueFrom(name);
  const initials = initialsFrom(name);

  return (
    <span
      aria-hidden="true"
      className="agent-avatar inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
        background: `hsl(${hue} 32% 88%)`,
        color: `hsl(${hue} 28% 28%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "live" | "active" | "paused" | "away" | "idle" | "quiet" | "error";
  children: string;
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function Meter({ value, live }: { value: number; live?: boolean }) {
  return (
    <div className={`meter ${live ? "meter-live" : ""}`} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
