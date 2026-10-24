import { STATION_IDS, type ChefResult, type StationId } from '@tilt-mayhem/shared';

export interface Award {
  title: string;
  emoji: string;
  why: string;
}

const STATION_TITLES: Record<StationId, Award> = {
  chop: { title: 'Knife Ninja', emoji: '🔪', why: 'chopped the most' },
  fry: { title: 'Flip Master', emoji: '🍳', why: 'flipped the most' },
  stir: { title: 'Swirl Lord', emoji: '🥄', why: 'stirred the most' },
  knead: { title: 'Dough Boss', emoji: '🫓', why: 'kneaded the most' },
  mix: { title: 'Whisk Taker', emoji: '🥣', why: 'mixed the most' },
  juice: { title: 'Juice Guru', emoji: '🧃', why: 'poured the most' },
};

/** Funny end-of-round awards; each one goes to a single chef. */
export function awardsFor(results: ChefResult[]): Map<string, Award[]> {
  const out = new Map<string, Award[]>();
  const give = (id: string | undefined, a: Award) => {
    if (!id) return;
    out.set(id, [...(out.get(id) ?? []), a]);
  };
  const fastest = results.filter((r) => r.fastestMs !== null).sort((a, b) => a.fastestMs! - b.fastestMs!)[0];
  give(fastest?.id, { title: 'Speed Demon', emoji: '⚡', why: 'fastest single dish' });
  const busiest = [...results].sort((a, b) => b.gestures - a.gestures)[0];
  if (busiest && busiest.gestures > 0) give(busiest.id, { title: 'Busy Bee', emoji: '🐝', why: 'most cooking motions' });
  const oops = [...results].sort((a, b) => b.oops - a.oops)[0];
  if (oops && oops.oops >= 2) give(oops.id, { title: 'Butterfingers', emoji: '🧈', why: 'most spills and fumbles' });
  for (const st of STATION_IDS) {
    const fans = results.filter((r) => r.favoriteStation === st);
    if (fans.length === 1) give(fans[0]!.id, STATION_TITLES[st]);
  }
  return out;
}

export function fmtSecs(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
