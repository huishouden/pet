import { expect, test } from 'bun:test';
import { PET_COLOURS, petColour, petNames, sortPets } from './pets';

const pets = [
  { id: 'b', name: 'Miso', createdAt: 2 },
  { id: 'a', name: 'Biscuit', createdAt: 1 },
  { id: 'c', name: 'Pip', createdAt: 3 },
];

test('pets keep the order they were added, and their colour', () => {
  expect(sortPets(pets).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  expect(petColour('a', pets)).toBe(PET_COLOURS[0]);
  expect(petColour('b', pets)).toBe(PET_COLOURS[1]);
  expect(petColour('gone', pets)).toBe(PET_COLOURS[0]);
});

test('names in a sentence', () => {
  expect(petNames(['a'], pets)).toBe('Biscuit');
  expect(petNames(['a', 'b'], pets)).toBe('Biscuit and Miso');
  expect(petNames(['a', 'b', 'c'], pets)).toBe('Biscuit, Miso and Pip');
  expect(petNames(['gone'], pets)).toBe('');
});
