import { colorVar } from '../utils/style';
import type { LeaderboardEntry, ServerError } from '@tilt-mayhem/shared';

interface Props {
  entries: LeaderboardEntry[];
  round: number;
  code: string;
  onRematch: () => void;
  busy: boolean;
  error: ServerError | null;
  canRematch: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({ entries, round, code, onRematch, busy, error, canRematch }: Props) {
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Visual order: 2nd, 1st, 3rd.
  const order = [podium[1], podium[0], podium[2]].filter((e): e is LeaderboardEntry => Boolean(e));

  return (
    <div className="results">
      <h1 className="results__title">Round {round} results</h1>
      <p className="muted">KO points · the last fighter standing earns a survival bonus</p>
      {entries[0] && (
        <p className="results__winner" style={{ color: entries[0].color }}>
          {entries.filter((e) => e.rank === 1).length > 1 ? "It's a tie!" : `${entries[0].nickname} wins!`}
        </p>
      )}

      <div className="podium">
        {order.map((e) => (
          <div key={e.id} className={`podium__col podium__col--${e.rank}`} style={colorVar(e.color)}>
            <span className="avatar avatar--lg">{Array.from(e.nickname)[0]?.toUpperCase()}</span>
            <span className="podium__name">{e.nickname}</span>
            <div className="podium__block">
              <span className="podium__medal">{MEDALS[e.rank - 1] ?? e.rank}</span>
              <span className="podium__score">{e.score}</span>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <ol className="results__rest" start={4}>
          {rest.map((e) => (
            <li key={e.id} style={colorVar(e.color)}>
              <span className="rank">#{e.rank}</span>
              <span className="name">{e.nickname}</span>
              <span className="score">{e.score}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="results__actions">
        <button className="btn btn--big btn--go" onClick={onRematch} disabled={busy || !canRematch}>
          {busy ? 'Starting…' : canRematch ? 'Rematch' : 'Need more players'}
        </button>
        <p className="muted">
          New players can join now with code <b>{code}</b>.
        </p>
        {error && <p className="error">{error.message}</p>}
      </div>
    </div>
  );
}
