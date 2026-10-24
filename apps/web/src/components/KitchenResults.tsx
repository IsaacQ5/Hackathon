import { stationById, type MatchResults, type ServerError } from '@tilt-mayhem/shared';
import { colorVar } from '../utils/style';
import { ChefPortrait } from './ChefPortrait';
import { awardsFor, fmtSecs, ordinal } from '../game/kawards';

interface Props {
  results: MatchResults;
  code: string;
  onRematch: () => void;
  busy: boolean;
  canRematch: boolean;
  error: ServerError | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function KitchenResults({ results, code, onRematch, busy, canRematch, error }: Props) {
  const winners = results.results.filter((r) => results.winnerIds.includes(r.id));
  const awards = awardsFor(results.results);
  const dishes = results.results.reduce((n, r) => n + r.served, 0);
  const headline =
    winners.length === 1 ? `${winners[0]!.nickname} IS HEAD CHEF!` : winners.length > 1 ? "IT'S A TIE!" : 'KITCHEN CLOSED!';

  return (
    <div className="kresults">
      <div className="kresults__hero">
        <div className="kresults__winners">
          {winners.map((w) => (
            <ChefPortrait key={w.id} color={w.color} size={150} />
          ))}
        </div>
        <h1 className="kresults__title" style={{ color: winners[0]?.color ?? '#fff' }}>
          {headline}
        </h1>
        <p className="kresults__sub">
          Round {results.round} · {dishes} dish{dishes === 1 ? '' : 'es'} served
        </p>
      </div>

      <table className="ktable">
        <thead>
          <tr>
            <th>Place</th>
            <th>Chef</th>
            <th>Points</th>
            <th>Dishes</th>
            <th>Fastest</th>
            <th>Favourite station</th>
            <th>Award</th>
          </tr>
        </thead>
        <tbody>
          {results.results.map((r) => (
            <tr key={r.id} style={colorVar(r.color)}>
              <td className="ktable__place">{MEDAL[r.placement - 1] ?? ordinal(r.placement)}</td>
              <td>
                <div className="ktable__who">
                  <ChefPortrait color={r.color} size={44} />
                  <span>{r.nickname}</span>
                </div>
              </td>
              <td className="ktable__pts">{r.score}</td>
              <td>{r.served}</td>
              <td>{r.fastestMs === null ? '–' : fmtSecs(r.fastestMs)}</td>
              <td>{r.favoriteStation ? `${stationById(r.favoriteStation).icon} ${stationById(r.favoriteStation).verb}` : '–'}</td>
              <td>
                <div className="ktable__awards">
                  {(awards.get(r.id) ?? []).map((a) => (
                    <span key={a.title} className="kaward" title={a.why}>
                      {a.emoji} {a.title}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="kresults__next">
        <button className="kbtn kbtn--go" onClick={onRematch} disabled={busy || !canRematch}>
          {busy ? 'Starting…' : canRematch ? 'ANOTHER SHIFT!' : 'Need more chefs'}
        </button>
        <p className="klobby__hint">
          New chefs can join now with code <b>{code}</b>.
        </p>
        {error && <p className="error">{error.message}</p>}
      </div>
    </div>
  );
}
