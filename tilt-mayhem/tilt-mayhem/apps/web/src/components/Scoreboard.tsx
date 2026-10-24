import { colorVar } from '../utils/style';
import type { PublicPlayer } from '@tilt-mayhem/shared';

export function Scoreboard({ players }: { players: PublicPlayer[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <aside className="scoreboard">
      <h3>Scores</h3>
      <ol>
        {sorted.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'away'} style={colorVar(p.color)}>
            <span className="avatar avatar--sm">{Array.from(p.nickname)[0]?.toUpperCase()}</span>
            <span className="name">{p.nickname}</span>
            <span className="score">{p.score}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
