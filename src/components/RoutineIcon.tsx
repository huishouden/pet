import { Brush, Droplets, Fish, House, Shovel, Sparkles, type LucideIcon } from 'lucide-react';
import type { RoutineKind } from '@huishouden/pwa-kit/pet-routines';

const ICONS: Record<RoutineKind, LucideIcon> = {
  scoop: Shovel,
  litter: Sparkles,
  brush: Brush,
  fountain: Droplets,
  fishWater: Fish,
  cage: House,
  custom: Sparkles,
};

/** One glyph per kind of routine, decorative. */
export function RoutineIcon({ kind, size = 20, className }: { kind: RoutineKind | undefined; size?: number; className?: string }) {
  const Icon = ICONS[kind ?? 'custom'];
  return <Icon size={size} className={className} aria-hidden="true" />;
}
