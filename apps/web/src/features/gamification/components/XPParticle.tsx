export interface XPParticleProps {
  readonly x: number;
  readonly y: number;
  readonly tx: number;
  readonly ty: number;
  readonly delay: number;
}

export function XPParticle({ x, y, tx, ty, delay }: XPParticleProps) {
  return (
    <div
      className="absolute pointer-events-none text-amber-400 text-lg font-bold animate-xp-float"
      style={
        {
          left: x,
          top: y,
          '--target-x': `${tx - x}px`,
          '--target-y': `${ty - y}px`,
          '--delay': `${delay}ms`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      ✦
    </div>
  );
}
