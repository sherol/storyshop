import type { Character, Role } from '../engine/types';

const ROLE_STYLE: Record<Role, string> = {
  victim: 'bg-sky-100 text-sky-900',
  aggressor: 'bg-rose-100 text-rose-900',
  bystander: 'bg-stone-200 text-stone-700',
};

export function RoleChips({
  roles,
  characters,
}: {
  roles: Record<string, Role[]>;
  characters: Character[];
}) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs">
      {characters.map((c) => (
        <li
          key={c.id}
          className="flex items-center gap-1 rounded-full border border-black/10 bg-white/60 py-0.5 pr-1 pl-2"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
          <span className="font-medium">{c.name}</span>
          {(roles[c.id] ?? []).length === 0 ? (
            <span className="rounded-full px-1.5 py-0.5 text-stone-500">no role</span>
          ) : (
            roles[c.id].map((r) => (
              <span key={r} className={`rounded-full px-1.5 py-0.5 ${ROLE_STYLE[r]}`}>
                {r}
              </span>
            ))
          )}
        </li>
      ))}
    </ul>
  );
}
