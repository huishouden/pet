import type { Pet } from './model';

/** Muted chart colours (DESIGN.md), terracotta left out because it means "needs attention". */
export const PET_COLOURS = ['#2d6a4f', '#5b7a99', '#8a6f9e', '#a8735a', '#6f8f72', '#44403c'];

/** Pets in the order they were added, so each keeps its place and colour. */
export function sortPets<T extends Pick<Pet, 'createdAt' | 'name'>>(pets: T[]): T[] {
  return [...pets].sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
}

export function petColour(petId: string, pets: Pick<Pet, 'id' | 'createdAt' | 'name'>[]): string {
  const i = sortPets(pets).findIndex((p) => p.id === petId);
  return PET_COLOURS[(i < 0 ? 0 : i) % PET_COLOURS.length];
}

/** "Biscuit", "Biscuit and Miso", "Biscuit, Miso and Pip"; missing pets are left out. */
export function petNames(ids: string[], pets: Pick<Pet, 'id' | 'name'>[]): string {
  const names = ids.map((id) => pets.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
