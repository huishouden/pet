import { Bird, Cat, Dog, Fish, PawPrint, Rabbit, Squirrel, Turtle, type LucideIcon } from 'lucide-react';
import type { Pet, Species } from '../lib/model';
import { petColour } from '../lib/pets';

const ICONS: Record<Species, LucideIcon> = {
  dog: Dog,
  cat: Cat,
  rabbit: Rabbit,
  bird: Bird,
  fish: Fish,
  reptile: Turtle,
  'small pet': Squirrel,
  other: PawPrint,
};

/** A pet's round mark: its species drawn in white on the pet's own muted colour. */
export function PetAvatar({ pet, pets, size = 40 }: { pet: Pet | undefined; pets: Pet[]; size?: number }) {
  const Icon = pet ? ICONS[pet.species] ?? PawPrint : PawPrint;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, backgroundColor: pet ? petColour(pet.id, pets) : '#78716c' }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}

/** Pet chips for filters and pickers: "All" plus one per pet. */
export function PetChips({ pets, selected, onSelect, all = true, label = 'Pets' }: {
  pets: Pet[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  all?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {all && (
        <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={chip(selected === null)}>
          All pets
        </button>
      )}
      {pets.map((p) => (
        <button key={p.id} type="button" aria-pressed={selected === p.id} onClick={() => onSelect(p.id)} className={chip(selected === p.id)}>
          <PetAvatar pet={p} pets={pets} size={28} />
          {p.name}
        </button>
      ))}
    </div>
  );
}

const chip = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border pr-4 text-base font-medium whitespace-nowrap transition-colors duration-150 has-[span]:pl-1.5 pl-4 ${
    active ? 'border-forest-700 bg-forest-700 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-forest-400'
  }`;
