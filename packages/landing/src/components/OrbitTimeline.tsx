import { useEffect, useRef, useState } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";

// ── types ────────────────────────────────────────────────────────────────────
export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

export interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  height?: string;
}

// ── inline mini-components (cosmic theme) ────────────────────────────────────
const C = {
  surface: "rgba(17, 11, 44, 0.96)",
  border: "rgba(236, 232, 255, 0.14)",
  accent: "#f5b038",
  accentRose: "#f2789f",
  text: "#f3edff",
  muted: "#a99cc9",
  mutedDim: "rgba(169, 156, 201, 0.6)",
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      overflow: "visible",
      backdropFilter: "blur(16px)",
      boxShadow: "0 32px 80px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(245,176,56,0.08)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "12px 16px 6px" }}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 8, color: C.text }}>
      {children}
    </div>
  );
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.75rem", color: C.muted, padding: "0 16px 16px" }}>{children}</div>;
}

function Badge({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: "0.62rem",
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      border: "1px solid currentColor",
      ...style,
    }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      height: 24,
      padding: "0 8px",
      fontSize: "0.72rem",
      border: `1px solid ${C.border}`,
      background: "transparent",
      color: C.mutedDim,
      cursor: "pointer",
      borderRadius: 4,
    }}>
      {children}
    </button>
  );
}

// ── status helpers ────────────────────────────────────────────────────────────
function statusStyle(status: TimelineItem["status"]): React.CSSProperties {
  switch (status) {
    case "completed":   return { color: C.accent, borderColor: C.accent };
    case "in-progress": return { color: C.accentRose, borderColor: C.accentRose };
    case "pending":     return { color: C.muted, borderColor: C.muted };
  }
}

function statusLabel(status: TimelineItem["status"]) {
  switch (status) {
    case "completed":   return "Complete";
    case "in-progress": return "In Progress";
    case "pending":     return "Pending";
  }
}

// ── main component ────────────────────────────────────────────────────────────
export default function RadialOrbitalTimeline({
  timelineData,
  height = "700px",
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number) =>
    timelineData.find((i) => i.id === itemId)?.relatedIds ?? [];

  const isRelatedToActive = (itemId: number) =>
    activeNodeId ? getRelatedItems(activeNodeId).includes(itemId) : false;

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const next = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      next[id] = !prev[id];
      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const pulse: Record<number, boolean> = {};
        getRelatedItems(id).forEach((rid) => { pulse[rid] = true; });
        setPulseEffect(pulse);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return next;
    });
  };

  useEffect(() => {
    if (!autoRotate) return;
    const id = setInterval(() => {
      setRotationAngle((a) => Number(((a + 0.3) % 360).toFixed(3)));
    }, 50);
    return () => clearInterval(id);
  }, [autoRotate]);

  const calculatePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const rad = (angle * Math.PI) / 180;
    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);
    const zIndex = Math.round(100 + 50 * Math.cos(rad));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(rad)) / 2)));
    return { x, y, zIndex, opacity };
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{
        position: "relative",
        width: "100%",
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* orbit ring */}
      <div style={{
        position: "absolute",
        width: 440,
        height: 440,
        borderRadius: "50%",
        border: `1px dashed rgba(236,232,255,0.14)`,
        pointerEvents: "none",
      }} />

      {/* center orb */}
      <div style={{
        position: "absolute",
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: `radial-gradient(circle, color-mix(in srgb, ${C.accent} 60%, transparent), ${C.accent} 40%, #f2789f 80%, transparent)`,
        boxShadow: `0 0 40px 10px rgba(245,176,56,0.25), 0 0 0 1px rgba(245,176,56,0.3)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        animation: "orb-pulse 4s ease-in-out infinite",
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(12,9,32,0.8)",
          backdropFilter: "blur(4px)",
        }} />
        {/* ping rings */}
        <div style={{
          position: "absolute",
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: `1px solid rgba(245,176,56,0.3)`,
          animation: "orb-ping 2s ease-out infinite",
        }} />
        <div style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: "50%",
          border: `1px solid rgba(245,176,56,0.15)`,
          animation: "orb-ping 2s ease-out 0.5s infinite",
        }} />
      </div>

      {/* nodes */}
      {timelineData.map((item, index) => {
        const pos = calculatePosition(index, timelineData.length);
        const isExpanded = !!expandedItems[item.id];
        const isRelated = isRelatedToActive(item.id);
        const isPulsing = !!pulseEffect[item.id];
        const Icon = item.icon;

        const nodeCircleStyle: React.CSSProperties = isExpanded
          ? {
              background: C.accent,
              color: "#0c0920",
              border: `2px solid ${C.accent}`,
              boxShadow: `0 0 24px 4px rgba(245,176,56,0.35)`,
              transform: "scale(1.5)",
            }
          : isRelated
          ? {
              background: "rgba(245,176,56,0.2)",
              color: C.text,
              border: `2px solid ${C.accent}`,
              animation: isPulsing ? "node-pulse 1s ease-in-out infinite" : undefined,
            }
          : {
              background: "rgba(17,11,44,0.9)",
              color: C.text,
              border: `2px solid ${C.border}`,
            };

        return (
          <div
            key={item.id}
            ref={(el) => { nodeRefs.current[item.id] = el; }}
            style={{
              position: "absolute",
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: isExpanded ? 200 : pos.zIndex,
              opacity: isExpanded ? 1 : pos.opacity,
              transition: "all 700ms cubic-bezier(0.4,0,0.2,1)",
              cursor: "pointer",
            }}
            onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
          >
            {/* energy halo */}
            <div style={{
              position: "absolute",
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(245,176,56,0.12) 0%, transparent 70%)`,
              width: item.energy * 0.5 + 40,
              height: item.energy * 0.5 + 40,
              left: -((item.energy * 0.5 + 40 - 40) / 2),
              top: -((item.energy * 0.5 + 40 - 40) / 2),
              animation: isPulsing ? "node-pulse 1s ease-in-out infinite" : undefined,
            }} />

            {/* node circle */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 300ms ease",
              ...nodeCircleStyle,
            }}>
              <Icon size={16} />
            </div>

            {/* label */}
            <div style={{
              position: "absolute",
              top: 48,
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: isExpanded ? C.accent : C.mutedDim,
              transition: "color 300ms ease",
              fontFamily: "var(--font-geist-mono, monospace)",
            }}>
              {item.title}
            </div>

            {/* expanded card */}
            {isExpanded && (
              <Card style={{
                position: "absolute",
                top: 80,
                left: "50%",
                transform: "translateX(-50%)",
                width: 260,
              }}>
                {/* connector line */}
                <div style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 1,
                  height: 12,
                  background: `rgba(245,176,56,0.4)`,
                }} />

                <CardHeader>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Badge style={statusStyle(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                    <span style={{ fontSize: "0.7rem", color: C.muted, fontFamily: "monospace" }}>
                      {item.date}
                    </span>
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>

                <CardContent>
                  <p>{item.content}</p>

                  {/* energy bar */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.7rem",
                      marginBottom: 6,
                      color: C.muted,
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Zap size={10} />
                        Energy
                      </span>
                      <span style={{ fontFamily: "monospace" }}>{item.energy}%</span>
                    </div>
                    <div style={{
                      width: "100%",
                      height: 4,
                      background: "rgba(236,232,255,0.08)",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${item.energy}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, #4078e0, ${C.accent})`,
                      }} />
                    </div>
                  </div>

                  {/* related nodes */}
                  {item.relatedIds.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 8,
                        fontSize: "0.66rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: C.muted,
                        fontFamily: "monospace",
                      }}>
                        <Link size={10} />
                        Connected
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {item.relatedIds.map((rid) => {
                          const rel = timelineData.find((i) => i.id === rid);
                          return (
                            <Btn
                              key={rid}
                              onClick={() => { toggleItem(rid); }}
                            >
                              {rel?.title}
                              <ArrowRight size={8} style={{ marginLeft: 2 }} />
                            </Btn>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {/* keyframe animations */}
      <style>{`
        @keyframes orb-pulse {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(245,176,56,0.20), 0 0 0 1px rgba(245,176,56,0.25); }
          50%       { box-shadow: 0 0 60px 18px rgba(245,176,56,0.35), 0 0 0 1px rgba(245,176,56,0.4); }
        }
        @keyframes orb-ping {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
