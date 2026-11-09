import type { StorySpec } from './types';

/**
 * rolemodel's own story (asp/storyspec.txt): Al and Parry are brothers, Eliza comes between
 * them, Parry kills Al. rolemodel's spec also required Eliza to be the aggressor; here that
 * is left out so the first spin shows the whole range. Add it back as a constraint to see the
 * space collapse to "Eliza pulled the strings".
 */
export const BROTHERS: StorySpec = {
  title: 'The Brothers',
  characters: [
    { id: 'al', name: 'Al', pronouns: 'he', color: '#f42e76' },
    { id: 'parry', name: 'Parry', pronouns: 'he', color: '#2f7de1' },
    { id: 'eliza', name: 'Eliza', pronouns: 'she', color: '#3fa34d' },
  ],
  scenes: [
    {
      id: 's1',
      title: 'Brothers',
      facts: [{ id: 'f1', kind: 'relation', a: 'al', b: 'parry', relation: 'siblings' }],
    },
    {
      id: 's2',
      title: 'Eliza arrives',
      facts: [
        { id: 'f2', kind: 'introduce', who: 'eliza' },
        { id: 'f3', kind: 'relation', a: 'eliza', b: 'parry', relation: 'acquaintances' },
        { id: 'f4', kind: 'relation', a: 'eliza', b: 'al', relation: 'acquaintances' },
      ],
    },
    {
      id: 's3',
      title: 'A couple',
      facts: [{ id: 'f5', kind: 'relation', a: 'eliza', b: 'al', relation: 'couple' }],
    },
    {
      id: 's4',
      title: 'Parry is distraught',
      facts: [{ id: 'f6', kind: 'mood', who: 'parry', mood: 'unhappy' }],
    },
    {
      id: 's5',
      title: 'Al dies',
      facts: [{ id: 'f7', kind: 'harm', actor: 'parry', target: 'al', act: 'kills' }],
    },
  ],
  constraints: [{ id: 'c1', kind: 'role', who: 'eliza', role: 'victim', mode: 'forbid' }],
};

export const LIGHTHOUSE: StorySpec = {
  title: 'The Lighthouse Lamp',
  characters: [
    { id: 'mara', name: 'Mara', pronouns: 'she', color: '#e08a1e' },
    { id: 'tomas', name: 'Tomas', pronouns: 'he', color: '#2f7de1' },
    { id: 'keeper', name: 'the Keeper', pronouns: 'they', color: '#7b5cd6' },
  ],
  scenes: [
    {
      id: 'l1',
      title: 'Two friends',
      facts: [{ id: 'g1', kind: 'relation', a: 'mara', b: 'tomas', relation: 'friends' }],
    },
    {
      id: 'l2',
      title: 'The Keeper',
      facts: [
        { id: 'g2', kind: 'introduce', who: 'keeper' },
        { id: 'g3', kind: 'gift', from: 'keeper', to: 'mara', object: 'a brass lamp' },
      ],
    },
    {
      id: 'l3',
      title: 'Envy',
      facts: [{ id: 'g4', kind: 'mood', who: 'tomas', mood: 'jealous' }],
    },
    {
      id: 'l4',
      title: 'The theft',
      facts: [{ id: 'g5', kind: 'harm', actor: 'tomas', target: 'mara', act: 'robs' }],
    },
  ],
  constraints: [{ id: 'k1', kind: 'theme', theme: 'cruelty', mode: 'forbid' }],
};

export const SAMPLES: StorySpec[] = [BROTHERS, LIGHTHOUSE];

export const BLANK: StorySpec = {
  title: 'Untitled story',
  characters: [],
  scenes: [],
  constraints: [],
};
