import type { Weight } from '../lib/model';
import { chart, formatWeight, type WeightUnit } from '../lib/weight';
import { formatDayShort } from '../lib/format';

const W = 560;
const H = 150;
const PAD = 14;

/** A small line chart of a pet's weighings, oldest to newest, in the pet's unit. */
export function WeightChart({ weights, unit }: { weights: Weight[]; unit: WeightUnit }) {
  const g = chart(weights, unit, W, H, PAD);
  if (!g || g.points.length < 2) return null;
  const first = g.points[0];
  const last = g.points.at(-1)!;
  return (
    <figure className="mt-3">
      <div className="flex gap-2">
        <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right text-xs text-stone-600 tabular-nums" aria-hidden="true">
          <span>{g.max.toFixed(1)}</span>
          <span>{g.min.toFixed(1)}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-36 w-full min-w-0"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Weight from ${formatWeight(first.value, unit)} on ${formatDayShort(first.at)} to ${formatWeight(last.value, unit)} on ${formatDayShort(last.at)}`}
        >
          <line x1="0" x2={W} y1={PAD} y2={PAD} stroke="#e7e5e4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={H - PAD} y2={H - PAD} stroke="#e7e5e4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={g.path} fill="none" stroke="#2d6a4f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* Dots drawn in HTML so they stay round when the chart stretches. */}
      <div className="relative -mt-36 ml-14 h-36" aria-hidden="true">
        {g.points.map((p) => (
          <span
            key={p.at}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-forest-600"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-1 ml-14 flex justify-between text-xs text-stone-600">
        <span>{formatDayShort(first.at)}</span>
        <span>{formatDayShort(last.at)}</span>
      </figcaption>
    </figure>
  );
}
