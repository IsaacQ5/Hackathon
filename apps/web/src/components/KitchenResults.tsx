import { stationById, type MatchResults, type RoomState } from '@tilt-mayhem/shared';
import { captainIdOf } from '../utils/room';
import { colorVar } from '../utils/style';
import { ChefPortrait } from './ChefPortrait';
import { Emoji, EmojiText } from './Emoji';
import { awardsFor, fmtSecs, ordinal } from '../game/kawards';

interface Props {
  results: MatchResults;
  room: RoomState;
  code: string;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function KitchenResults({ results, room, code }: Props) {
  const captainId = captainIdOf(room);
  const captain = room.players.find((p) => p.id === captainId);
  const need = Math.max(0, room.minPlayers - room.players.filter((p) => p.connected).length);
  const winners = results.results.filter((r) => results.winnerIds.includes(r.id));
  const losers = results.results.filter((r) => !results.winnerIds.includes(r.id));
  const awards = awardsFor(results.results);
  const dishes = results.results.reduce((n, r) => n + r.served, 0);
  const headline =
    winners.length === 1 ? `${winners[0]!.nickname} IS HEAD CHEF!` : winners.length > 1 ? "IT'S A TIE!" : 'KITCHEN CLOSED!';

  return (
    <div className="kresults">
      <div className="kresults__hero">
        {/* Winner up front with a crown, dancing; everyone else further back, faded and sad. */}
        <div className="kresults__stage">
          {losers.length > 0 && (
            <div className="kresults__crowd">
              {losers.map((l) => (
                <ChefPortrait key={l.id} color={l.color} face={l.face} size={90} mood="sad" />
              ))}
            </div>
          )}
          <div className="kresults__winners">
            {winners.map((w) => (
              <ChefPortrait key={w.id} color={w.color} face={w.face} size={170} crown mood="dance" />
            ))}
          </div>
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
              <td className="ktable__place">{MEDAL[r.placement - 1] ? <Emoji ch={MEDAL[r.placement - 1]!} /> : ordinal(r.placement)}</td>
              <td>
                <div className="ktable__who">
                  <ChefPortrait color={r.color} face={r.face} size={44} />
                  <span>{r.nickname}</span>
                </div>
              </td>
              <td className="ktable__pts">{r.score}</td>
              <td>{r.served}</td>
              <td>{r.fastestMs === null ? '–' : fmtSecs(r.fastestMs)}</td>
              <td>{r.favoriteStation ? <EmojiText text={`${stationById(r.favoriteStation).icon} ${stationById(r.favoriteStation).verb}`} /> : '–'}</td>
              <td>
                <div className="ktable__awards">
                  {(awards.get(r.id) ?? []).map((a) => (
                    <span key={a.title} className="kaward" title={a.why}>
                      <Emoji ch={a.emoji} /> {a.title}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="kresults__next">
        <p className="klobby__start">
          <EmojiText text={need > 0 ? 'Need more chefs for another shift' : `📱 ${captain?.nickname ?? 'The head chef'} starts the next shift from their phone`} />
        </p>
        <p className="klobby__hint">
          New chefs can join now with code <b>{code}</b>.
        </p>
      </div>
    </div>
  );
}
