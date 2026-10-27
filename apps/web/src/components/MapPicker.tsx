import { useEffect, useRef, useState } from 'react';
import { CHAOS, CHAOS_LEVELS, MAP_IDS, MAPS, type ChaosLevel, type MapId } from '@tilt-mayhem/shared';
import { drawMapPreview } from '../game/mapArt';
import { api } from '../network/socket';
import { Icon } from './Icon';

/** Little still picture of a map's kitchen. */
export function MapThumb({ map, width = 160 }: { map: MapId; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round((width * 660) / 1060);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMapPreview(ctx, map, width, height);
  }, [map, width, height]);
  return <canvas ref={ref} className="kmap__thumb" style={{ width, height }} aria-hidden />;
}

/**
 * Map + chaos level choice, between shifts. The head chef's phone and the host screen can both
 * change it (the server checks); everyone else just sees it.
 */
export function MapPicker({ map, chaos, canEdit, compact = false }: { map: MapId; chaos: ChaosLevel; canEdit: boolean; compact?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null);
    const res = await p;
    if (!res.ok) setError(res.error?.message ?? 'Could not change that.');
  };

  return (
    <div className={`kmap ${compact ? 'kmap--compact' : ''}`}>
      <p className="kcustom__label">Map</p>
      <div className="kmap__grid">
        {MAP_IDS.map((id) => (
          <button
            key={id}
            className={`kmap__card ${id === map ? 'is-on' : ''}`}
            disabled={!canEdit && id !== map}
            onClick={() => canEdit && void run(api.setMap(id))}
            title={MAPS[id].blurb}
          >
            <MapThumb map={id} width={compact ? 120 : 150} />
            <span className="kmap__name">
              <Icon name={MAPS[id].icon} /> {MAPS[id].name}
            </span>
          </button>
        ))}
      </div>
      {!compact && <p className="kmap__blurb">{MAPS[map].blurb}</p>}
      <p className="kcustom__label">Kitchen chaos</p>
      <div className="kseg">
        {CHAOS_LEVELS.map((l) => (
          <button key={l} className={l === chaos ? 'is-on' : ''} disabled={!canEdit && l !== chaos} onClick={() => canEdit && void run(api.setChaos(l))} title={CHAOS[l].blurb}>
            {CHAOS[l].name}
          </button>
        ))}
      </div>
      <p className="kmap__blurb small">{CHAOS[chaos].blurb}</p>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
