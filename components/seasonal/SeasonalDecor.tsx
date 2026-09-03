import type { CSSProperties } from 'react';
import type { SeasonalThemeResolution } from '@/lib/seasonal-theme';

type Props = Pick<SeasonalThemeResolution, 'variant' | 'intensity'> & {
  particle: string;
};

type DecorStyle = CSSProperties & Record<`--${string}`, string>;

const LIGHT_COLORS = ['red', 'gold', 'green', 'blue'] as const;
const FIREWORKS = [
  { left: '14%', top: '18%', color: '#fbbf24', delay: '-.4s' },
  { left: '78%', top: '12%', color: '#38bdf8', delay: '-1.2s' },
  { left: '55%', top: '42%', color: '#f472b6', delay: '-2s' },
] as const;

export default function SeasonalDecor({ variant, intensity, particle }: Props) {
  if (variant === 'christmas') {
    return (
      <div className={`christmas-decor christmas-decor-${intensity}`} aria-hidden="true">
        <div className="christmas-light-wire" />
        <div className="christmas-lights">
          {Array.from({ length: intensity === 'festive' ? 16 : 12 }, (_, index) => (
            <i
              key={index}
              className={`christmas-bulb christmas-bulb-${LIGHT_COLORS[index % LIGHT_COLORS.length]}`}
              style={{ '--light-delay': `${-(index % 5) * 0.35}s` } as DecorStyle}
            />
          ))}
        </div>
        {[12, 50, 88].map((left, index) => (
          <div
            key={left}
            className="christmas-parol"
            style={{ left: `${left}%`, '--parol-delay': `${index * -0.7}s` } as DecorStyle}
          >
            <div className="christmas-parol-star" />
            <i className="christmas-parol-tail christmas-parol-tail-left" />
            <i className="christmas-parol-tail christmas-parol-tail-right" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'halloween') {
    return (
      <div className="seasonal-props halloween-props" aria-hidden="true">
        <div className="halloween-web halloween-web-left" />
        <div className="halloween-web halloween-web-right" />
        <i className="halloween-pumpkin halloween-pumpkin-left" />
        <i className="halloween-pumpkin halloween-pumpkin-right" />
      </div>
    );
  }

  if (variant === 'new_year') {
    return (
      <div className="seasonal-props new-year-props" aria-hidden="true">
        {FIREWORKS.map(({ left, top, color, delay }) => (
          <i key={left} className="new-year-firework" style={{ left, top, '--firework-color': color, '--firework-delay': delay } as DecorStyle} />
        ))}
        <i className="new-year-torotot" />
      </div>
    );
  }

  if (variant === 'sunny') {
    return (
      <div className="seasonal-props sunny-props" aria-hidden="true">
        <div className="sunny-sun" />
        <div className="sunny-banderitas">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
        <div className="sunny-sampaguita sunny-sampaguita-left">✿</div>
        <div className="sunny-sampaguita sunny-sampaguita-right">✿</div>
      </div>
    );
  }

  return (
    <>
      <div className="seasonal-props rainy-props" aria-hidden="true">
        <div className="rainy-cloud rainy-cloud-left" />
        <div className="rainy-cloud rainy-cloud-right" />
        <i className="rainy-umbrella rainy-umbrella-left" />
        <i className="rainy-umbrella rainy-umbrella-right" />
      </div>
      <div className="seasonal-particles" aria-hidden="true">
        {Array.from({ length: intensity === 'festive' ? 22 : 14 }, (_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 37) % 100}%`,
              fontSize: `${10 + (index % 4) * 3}px`,
              '--snow-speed': `${9 + (index % 6) * 2}s`,
              '--snow-delay': `${-(index % 8) * 1.7}s`,
              '--snow-drift': `${(index % 2 ? 1 : -1) * (18 + index)}px`,
              '--snow-static-top': `${8 + (index * 41) % 84}%`,
            } as DecorStyle}
          >
            {particle}
          </span>
        ))}
      </div>
    </>
  );
}
