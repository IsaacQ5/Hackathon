import type { StationId, StuckKind } from '@tilt-mayhem/shared';
import { Icon } from './Icon';
import '../styles/demo.css';

/** Station motions, plus the hazard recoveries (which reuse a station's motion). */
export type DemoScene = StationId | StuckKind;

/**
 * Little animated scene showing exactly what to do with the phone: a phone doing
 * the motion over the matching kitchen setup (a board that gets chopped, a pot that
 * swirls, dough that squishes...). Pure CSS animation, see styles/demo.css.
 */
export function GestureDemo({ scene }: { scene: DemoScene }) {
  return (
    <div className={`kdemo kdemo--${scene}`} aria-hidden>
      <div className="kdemo__shadow" />
      <Props scene={scene} />
      <div className="kdemo__phone">
        <div className="kdemo__back" />
        <div className="kdemo__front">
          <div className="kdemo__screen" />
        </div>
      </div>
      <Effects scene={scene} />
    </div>
  );
}

/** What sits under the phone. */
function Props({ scene }: { scene: DemoScene }) {
  switch (scene) {
    case 'chop':
      return (
        <div className="kdemo__board">
          <Icon name="carrot" className="kdemo__veg" />
        </div>
      );
    case 'fry':
      return <div className="kdemo__flame" />;
    case 'stir':
      return (
        <div className="kdemo__pot">
          <div className="kdemo__soup">
            <div className="kdemo__swirl" />
          </div>
        </div>
      );
    case 'knead':
      return (
        <div className="kdemo__slab">
          <div className="kdemo__dough" />
        </div>
      );
    case 'mix':
      return (
        <div className="kdemo__bowl">
          <div className="kdemo__batter" />
        </div>
      );
    case 'juice':
      return <Icon name="juicebox" className="kdemo__glass" />;
    case 'slip':
      return (
        <div className="kdemo__puddle">
          <div className="kdemo__swirl" />
        </div>
      );
    case 'bonk':
      return <div className="kdemo__floor" />;
    case 'feathers':
      return null;
    case 'fire':
      return <Icon name="fire" className="kdemo__fire" />;
  }
}

/** Things that fly around: slices, the flipped food, juice, splashes, stars, feathers, foam. */
function Effects({ scene }: { scene: DemoScene }) {
  switch (scene) {
    case 'chop':
      return (
        <>
          <span className="kdemo__slice kdemo__slice--1" />
          <span className="kdemo__slice kdemo__slice--2" />
          <span className="kdemo__slice kdemo__slice--3" />
        </>
      );
    case 'fry':
      return <Icon name="bacon" className="kdemo__toss" />;
    case 'juice':
      return <div className="kdemo__stream" />;
    case 'mix':
      return (
        <>
          <span className="kdemo__drop kdemo__drop--1" />
          <span className="kdemo__drop kdemo__drop--2" />
        </>
      );
    case 'slip':
      return (
        <>
          <span className="kdemo__bubble kdemo__bubble--1" />
          <span className="kdemo__bubble kdemo__bubble--2" />
        </>
      );
    case 'bonk':
      return (
        <div className="kdemo__stars">
          <Icon name="star" />
          <Icon name="star" />
          <Icon name="star" />
        </div>
      );
    case 'feathers':
      return (
        <>
          <Icon name="feather" className="kdemo__feather kdemo__feather--1" />
          <Icon name="feather" className="kdemo__feather kdemo__feather--2" />
          <Icon name="feather" className="kdemo__feather kdemo__feather--3" />
        </>
      );
    case 'fire':
      return (
        <>
          <span className="kdemo__foam kdemo__foam--1" />
          <span className="kdemo__foam kdemo__foam--2" />
          <span className="kdemo__foam kdemo__foam--3" />
        </>
      );
    default:
      return null;
  }
}
