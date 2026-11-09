/**
 * The story model.
 *
 * A StorySpec is what the author pins down: who is in the story, what visibly happens in each
 * scene, and which readings are allowed. The engine fills in what the author left open (why
 * each harm happened, how onlookers reacted, what caused a mood) and keeps only the tellings
 * that satisfy every constraint. This mirrors rolemodel's ASP setup, where `author_spec` facts
 * are fixed and the solver abduces the explanations that decide each character's role.
 */

export type PronounSet = 'he' | 'she' | 'they';

export interface Character {
  id: string;
  name: string;
  pronouns: PronounSet;
  color: string;
}

export type Relation = 'siblings' | 'friends' | 'acquaintances' | 'couple' | 'rivals';
export type Mood = 'unhappy' | 'afraid' | 'jealous' | 'lonely';
export type HarmAct = 'kills' | 'attacks' | 'betrays' | 'robs';

export type Fact =
  | { id: string; kind: 'relation'; a: string; b: string; relation: Relation }
  | { id: string; kind: 'introduce'; who: string }
  | { id: string; kind: 'mood'; who: string; mood: Mood }
  | { id: string; kind: 'gift'; from: string; to: string; object: string }
  | { id: string; kind: 'harm'; actor: string; target: string; act: HarmAct };

export type FactKind = Fact['kind'];

export interface Scene {
  id: string;
  title: string;
  facts: Fact[];
}

export type Role = 'victim' | 'aggressor' | 'bystander';

export type Theme =
  | 'cruelty'
  | 'betrayal'
  | 'revenge'
  | 'survival'
  | 'tragedy'
  | 'despair'
  | 'grief'
  | 'spite'
  | 'love'
  | 'jealousy';

/** Why a harm happened. Each one changes who counts as victim and aggressor. */
export type Frame =
  'deliberate' | 'manipulated' | 'revenge' | 'selfDefense' | 'accident' | 'willing';

export type Constraint =
  | { id: string; kind: 'role'; who: string; role: Role; mode: 'require' | 'forbid' }
  | { id: string; kind: 'theme'; theme: Theme; mode: 'require' | 'forbid' }
  | { id: string; kind: 'frame'; frame: Frame; mode: 'forbid' }
  | { id: string; kind: 'pin'; choiceId: string; optionId: string; label: string };

export interface StorySpec {
  title: string;
  characters: Character[];
  scenes: Scene[];
  constraints: Constraint[];
}

/** One open question the engine gets to answer. */
export interface ChoicePoint {
  id: string;
  sceneIndex: number;
  factId: string;
  kind: 'frame' | 'reaction' | 'cause';
  /** Plain-language question, e.g. "Why did Parry kill Al?" */
  question: string;
  options: ChoiceOption[];
}

export interface ChoiceOption {
  id: string;
  label: string;
}

/** Choice point id -> option id. */
export type Choices = Record<string, string>;

export interface Evaluation {
  roles: Record<string, Role[]>;
  themes: Theme[];
  /** Constraint ids that this telling breaks. Internal consistency rules use `rule:` ids. */
  broken: string[];
}

export type IconKey =
  | 'siblings'
  | 'friends'
  | 'acquaintances'
  | 'couple'
  | 'rivals'
  | 'introduce'
  | 'mood'
  | 'gift'
  | 'kills'
  | 'attacks'
  | 'betrays'
  | 'robs'
  | 'cover'
  | 'end';

export type Tone = 'dawn' | 'warm' | 'calm' | 'gloomy' | 'dark';

export interface Page {
  kind: 'cover' | 'scene' | 'end';
  title: string;
  text: string;
  /** rolemodel-style logic behind the page, shown on request. */
  logic: string[];
  /** Choice points whose answers shape this page. */
  choiceIds: string[];
  cast: string[];
  icon: IconKey;
  tone: Tone;
}

export interface Variation {
  id: string;
  /** The spec this telling was spun from, so it stays readable after the spec changes. */
  spec: StorySpec;
  choices: Choices;
  pages: Page[];
  roles: Record<string, Role[]>;
  themes: Theme[];
  logline: string;
  /** Page index -> the co-author's rewrite of that page. */
  overrides: Record<number, string>;
}
