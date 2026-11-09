import {
  BookOpen,
  CloudRain,
  Gift,
  Hand,
  Heart,
  HeartCrack,
  type LucideIcon,
  Sparkles,
  Swords,
  Users,
  Zap,
  Handshake,
  Flame,
  Feather,
} from 'lucide-react';
import type { Character, IconKey, Tone } from '../engine/types';

const ICONS: Record<IconKey, LucideIcon> = {
  siblings: Users,
  friends: Handshake,
  acquaintances: Hand,
  couple: Heart,
  rivals: Flame,
  introduce: Sparkles,
  mood: CloudRain,
  gift: Gift,
  kills: Swords,
  attacks: Zap,
  betrays: HeartCrack,
  robs: Hand,
  cover: BookOpen,
  end: Feather,
};

const SKIES: Record<Tone, [string, string, string]> = {
  dawn: ['#fde7c8', '#f6c9a8', '#c99c74'],
  warm: ['#ffe2d6', '#f7b9a6', '#c98a6d'],
  calm: ['#d9ecf2', '#b7d6e3', '#8fb18b'],
  gloomy: ['#cfd3da', '#a9b0bd', '#7d8a7b'],
  dark: ['#3a3550', '#5b4a6b', '#3e4a3c'],
};

/** A simple picture-book plate: sky, hills, the scene's cast, and an emblem for what happens. */
export function Illustration({
  cast,
  characters,
  icon,
  tone,
  label,
}: {
  cast: string[];
  characters: Character[];
  icon: IconKey;
  tone: Tone;
  label: string;
}) {
  const [top, mid, ground] = SKIES[tone];
  const people = cast
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c)
    .slice(0, 5);
  const Icon = ICONS[icon];
  const dark = tone === 'dark';
  const gradId = `sky-${tone}`;

  return (
    <div className="relative h-full w-full overflow-hidden" role="img" aria-label={label}>
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={mid} />
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill={`url(#${gradId})`} />
        {dark ? (
          <g fill="#f6efe2" opacity="0.8">
            <circle cx="300" cy="105" r="18" />
            <circle cx="90" cy="90" r="1.6" />
            <circle cx="150" cy="130" r="1.2" />
            <circle cx="230" cy="75" r="1.4" />
            <circle cx="330" cy="170" r="1.1" />
          </g>
        ) : (
          <circle cx="295" cy="110" r="26" fill="#fff6dc" opacity="0.85" />
        )}
        <path d="M0 250 Q100 210 200 245 T400 235 V400 H0Z" fill={ground} opacity="0.75" />
        <path d="M0 280 Q120 255 230 280 T400 275 V400 H0Z" fill={ground} />
        {people.map((c, i) => {
          // Keep the cast inside the middle of the plate: it is cropped to fit tall and wide pages.
          const x = 60 + ((i + 1) * 280) / (people.length + 1);
          return (
            <g key={c.id} transform={`translate(${x} 245) scale(${people.length > 3 ? 0.8 : 1})`}>
              <ellipse cx="0" cy="44" rx="20" ry="5" fill="#000" opacity="0.15" />
              <path d="M-18 42 Q0 -6 18 42Z" fill={c.color} />
              <circle cx="0" cy="-6" r="13" fill="#f3d9bd" stroke={c.color} strokeWidth="3" />
              <text
                y="64"
                textAnchor="middle"
                fontSize="13"
                fontFamily="Fraunces, Georgia, serif"
                fill={dark ? '#f6efe2' : '#2b211b'}
              >
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        className={`absolute top-4 left-4 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
          dark ? 'border-paper/60 text-paper' : 'border-binding/40 text-binding'
        } bg-white/20 backdrop-blur-sm`}
      >
        <Icon size={22} aria-hidden />
      </div>
    </div>
  );
}
