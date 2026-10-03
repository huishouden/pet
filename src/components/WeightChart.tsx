import { QuantityChart } from '@huishouden/pwa-kit/react/chart';
import type { Weight } from '../lib/model';
import { formatWeight, series, type WeightUnit } from '../lib/weight';

/** A small line chart of a pet's weighings, oldest to newest, in the pet's unit. */
export function WeightChart({ weights, unit, target }: { weights: Weight[]; unit: WeightUnit; target?: number }) {
  return <QuantityChart label="Weight" points={series(weights, unit).map((w) => ({ at: w.at, value: w.shown }))} target={target} format={(v) => formatWeight(v, unit)} />;
}
