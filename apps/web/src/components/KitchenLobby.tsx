import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { STATIONS, type RoomState } from '@tilt-mayhem/shared';
import { captainIdOf, roundMinutesOf } from '../utils/room';
import { colorVar } from '../utils/style';
import { ChefPortrait } from './ChefPortrait';
import { Emoji, EmojiText } from './Emoji';

interface Props {
  room: RoomState;
  joinUrl: string;
}

export function KitchenLobby({ room, joinUrl }: Props) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: '#2b1a12', light: '#ffffff' } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const connected = room.players.filter((p) => p.connected).length;
  const need = Math.max(0, room.minPlayers - connected);
  const isLocal = /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(joinUrl);
  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);
  const captainId = captainIdOf(room);
  const captain = room.players.find((p) => p.id === captainId);
  const minutes = roundMinutesOf(room);

  return (
    <div className="klobby">
      <section className="kcard klobby__join">
        <h2>Grab an apron!</h2>
        {qr ? <img className="klobby__qr" src={qr} alt={`QR code for ${joinUrl}`} /> : <div className="klobby__qr" />}
        <p className="klobby__url">{joinUrl.replace(/^https?:\/\//, '')}</p>
        <p className="klobby__label">KITCHEN CODE</p>
        <p className="klobby__code">{room.code}</p>
        {isLocal && (
          <p className="warn">
            Phones can't open <b>localhost</b>. Use the https tunnel or live link (see README).
          </p>
        )}
      </section>

      <section className="kcard klobby__main">
        <div className="klobby__head">
          <h2>Chefs</h2>
          <span className="kpill">
            {room.players.length} / {room.maxPlayers}
          </span>
        </div>
        <ul className="kslots">
          {slots.map((p, i) =>
            p ? (
              <li key={p.id} className="kslot kslot--on" style={colorVar(p.color)}>
                <ChefPortrait color={p.color} face={p.face} size={78} dim={!p.connected} />
                <span className="kslot__name">{p.nickname}</span>
                {p.id === captainId && <span className="kslot__boss">HEAD CHEF</span>}
                {!p.connected && <span className="kslot__away">away</span>}
              </li>
            ) : (
              <li key={`e${i}`} className="kslot">
                <Emoji ch="🧑‍🍳" className="kslot__q" />
              </li>
            ),
          )}
        </ul>

        <div className="kstations">
          {STATIONS.map((s) => (
            <div key={s.id} className="kstation" style={colorVar(s.color)}>
              <Emoji ch={s.icon} className="kstation__icon" />
              <b>{s.verb}</b>
              <span>{s.name}</span>
            </div>
          ))}
        </div>

        <ol className="khowto">
          <li>Every chef gets a recipe with 4 ingredients from 4 stations.</li>
          <li>Tilt to walk to a station. When your phone buzzes, tap the button.</li>
          <li>Do the motion: chop, flip, stir, knead, mix or pour!</li>
          <li>Bring all 4 to the SERVE table in the middle and hit SERVE. Most points in {minutes}:00 wins.</li>
          <li>The last 30 seconds are RUSH HOUR: double points!</li>
          <li>Watch out! Spills, fires, a loose chicken, meatball meteors and runaway cheese get wilder as the shift goes on. If one gets you, your phone shows the move to get back up.</li>
          <li>Get in someone's way? Shake your phone hard right next to them to PUSH them (5 second recharge).</li>
        </ol>

        <p className="klobby__start">
          {need > 0
            ? `Need ${need} more chef${need === 1 ? '' : 's'}`
            : <EmojiText text={`${captain?.nickname ?? 'The head chef'} opens the kitchen from their phone`} />}
          <span className="kpill">{minutes} min shift</span>
        </p>
      </section>
    </div>
  );
}
