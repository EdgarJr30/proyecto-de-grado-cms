import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

type ParsedAnimatedValue = {
  target: number;
  format: (value: number) => string;
};

interface CountUpTextProps {
  value: number | string;
  className?: string;
  locale?: string;
  duration?: number;
  delay?: number;
  startFrom?: number;
}

function getFractionDigits(value: number) {
  const stringValue = value.toString();
  const dotIndex = stringValue.indexOf('.');
  if (dotIndex === -1) return 0;
  return stringValue.length - dotIndex - 1;
}

function parseValue(value: number | string, locale: string): ParsedAnimatedValue | null {
  if (typeof value === 'number') {
    const fractionDigits = getFractionDigits(value);
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });

    return {
      target: value,
      format: (nextValue) => formatter.format(nextValue),
    };
  }

  const match = value.match(/-?\d[\d,.]*/);
  if (!match || match.index === undefined) return null;

  const rawNumericPart = match[0];
  const target = Number(rawNumericPart.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;

  const fractionDigits = rawNumericPart.includes('.')
    ? rawNumericPart.split('.').pop()?.length ?? 0
    : 0;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  const prefix = value.slice(0, match.index);
  const suffix = value.slice(match.index + rawNumericPart.length);

  return {
    target,
    format: (nextValue) => `${prefix}${formatter.format(nextValue)}${suffix}`,
  };
}

function defaultFallback(value: number | string, locale: string) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat(locale).format(value);
  }
  return value;
}

export default function CountUpText({
  value,
  className,
  locale = 'es-DO',
  duration = 0.9,
  delay = 0,
  startFrom,
}: CountUpTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const parsed = useMemo(() => parseValue(value, locale), [value, locale]);
  const fallback = useMemo(() => defaultFallback(value, locale), [value, locale]);

  const [displayValue, setDisplayValue] = useState(() =>
    parsed ? parsed.format(parsed.target) : fallback
  );

  useEffect(() => {
    if (!parsed) {
      setDisplayValue(fallback);
      return;
    }

    if (prefersReducedMotion) {
      setDisplayValue(parsed.format(parsed.target));
      return;
    }

    const inferredStart =
      typeof startFrom === 'number'
        ? startFrom
        : Math.abs(parsed.target) >= 1
          ? Math.sign(parsed.target) || 1
          : 0;

    const controls = animate(inferredStart, parsed.target, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        setDisplayValue(parsed.format(latest));
      },
    });

    return () => {
      controls.stop();
    };
  }, [parsed, fallback, prefersReducedMotion, duration, delay, startFrom]);

  return <span className={className}>{displayValue}</span>;
}
