import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CHAOS, MAPS, type RoomState } from '@tilt-mayhem/shared';
import type { KitchenBuffer } from '../game/kbuffer';
import { captainIdOf, roundMinutesOf } from '../utils/room';
import { colorVar } from '../utils/style';
import { ChefPortrait } from './ChefPortrait';
import { KitchenArena } from './KitchenArena';
import { MapThumb } from './MapPicker';

interface Props {
  room: RoomState;
  joinUrl: string;
  /** Live snapshots of the lobby apartment the chefs walk around in. */
  buffer: KitchenBuffer;
}

export function KitchenLobby({ room, joinUrl, buffer }: Props) {
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
  const captainId = captainIdOf(room);
  const captain = room.players.find((p) => p.id === captainId);
  const minutes = roundMinutesOf(room);
  const pushOn = room.pushEnabled !== false;
  const map = MAPS[room.map ?? 'kitchen'];

  return (
    <div className="klobby">
      <section className="kcard klobby__join">
        <h2>Grab an apron!</h2>
        {qr ? <img className="klobby__qr" src={qr} alt={`QR code for ${joinUrl}`} /> : <div className="klobby__qr" />}
        <p className="klobby__url">{joinUrl.replace(/^https?:\/\//, '')}</p>
        <p className="klobby__label">KITCHEN CODE</p>
        <p className="klobby__code">{room.code}</p>
        {/* the head chef picks the kitchen on their phone; the TV just shows it */}
        <p className="klobby__label">NEXT KITCHEN</p>
        <MapThumb map={room.map ?? 'kitchen'} width={220} />
        <p className="klobby__mapname">
          {map.name} · {CHAOS[room.chaos ?? 'medium'].name} chaos
        </p>
        {isLocal && (
          <p className="warn">
            Phones can't open <b>localhost</b>. Use the https tunnel or live link (see README).
          </p>
        )}
      </section>

      <section className="kcard klobby__main">
        <div className="klobby__head">
          <h2>The apartment</h2>
          <span className="kpill">
            {room.players.length} / {room.maxPlayers} chefs
          </span>
        </div>
        <p className="klobby__hint">
          Walk around with your phone! Step on the pink rug to change your look, practise any station in the kitchen, and
          step into the <b>READY?</b> elevator when you're set. Everyone in, and the shift starts (or the head chef waits
          inside for 10 seconds).
        </p>
        {/* PlateUp-style: everyone hangs out here until the head chef opens the kitchen */}
        <div className="klobby__apartment">
          <KitchenArena buffer={buffer} map={room.map ?? 'kitchen'} />
        </div>
        <ul className="kroster">
          {room.players.map((p) => (
            <li key={p.id} className={`kroster__chef ${p.connected ? '' : 'is-away'}`} style={colorVar(p.color)}>
              <ChefPortrait color={p.color} face={p.face} size={34} dim={!p.connected} />
              <span>{p.nickname}</span>
              {p.id === captainId && <b className="kroster__boss">HEAD CHEF</b>}
            </li>
          ))}
        </ul>

        <ol className="khowto">
          <li>Every chef gets a recipe with 4 ingredients from 4 stations.</li>
          <li>Tilt to walk to a station. When your phone buzzes, tap the button.</li>
          <li>Do the motion: chop, flip, stir, knead, mix or pour!</li>
          <li>Bring all 4 to the SERVE table in the middle and hit SERVE. Most points in {minutes}:00 wins.</li>
          <li>The last 30 seconds are RUSH HOUR: double points!</li>
          <li>Watch out! {map.blurb} It all gets wilder as the shift goes on. If something gets you, your phone shows the move to get back up.</li>
          {pushOn && <li>Get in someone's way? Shake your phone hard right next to them to PUSH them (5 second recharge).</li>}
        </ol>

        <p className="klobby__start">
          {need > 0
            ? `Need ${need} more chef${need === 1 ? '' : 's'}`
            : `${captain?.nickname ?? 'The head chef'} opens the kitchen from their phone`}
          <span className="kpill">{minutes} min shift</span>
          <span className="kpill">Pushing {pushOn ? 'on' : 'off'}</span>
          <span className="kpill">{CHAOS[room.chaos ?? 'medium'].name} chaos</span>
        </p>
      </section>
    </div>
  );
}
