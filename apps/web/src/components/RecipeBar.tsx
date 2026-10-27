import { INGREDIENTS, recipeById, stationById } from '@tilt-mayhem/shared';
import { colorVar } from '../utils/style';
import { Icon } from './Icon';

interface Props {
  recipeId: string;
  have: string[];
  workingIngredient: string | null;
}

/** Top of the phone: the dish, then 4 station symbols with the needed food below each. */
export function RecipeBar({ recipeId, have, workingIngredient }: Props) {
  const recipe = recipeById(recipeId);
  if (!recipe) return null;
  return (
    <section className="krecipe">
      <p className="krecipe__dish">
        <Icon name={recipe.icon} /> {recipe.name}
      </p>
      <div className="krecipe__slots">
        {recipe.ingredients.map((id) => {
          const info = INGREDIENTS.get(id)!;
          const st = stationById(info.station);
          const done = have.includes(id);
          const active = workingIngredient === id;
          return (
            <div key={id} className={`krecipe__slot ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`} style={colorVar(st.color)}>
              <Icon name={st.icon} className="krecipe__sym" />
              <span className="krecipe__verb">{st.verb}</span>
              <Icon name={info.ingredient.icon} className="krecipe__food" />
              <span className="krecipe__name">{info.ingredient.name.replace(/^(Chopped|Sliced|Diced|Cooked|Fried|Grilled) /, '')}</span>
              {done && <Icon name="check" className="krecipe__tick" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
