import React, {useEffect, useRef, useState} from 'react';
import {animate, useReducedMotion} from 'motion/react';

interface AnimatedNumberProps {
  value: number | null;
  decimals?: number;
  adaptiveDecimals?: boolean;
  fallback?: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 1,
  adaptiveDecimals = false,
  fallback = '--',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(value ?? 0);
  const currentRef = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value === null) {
      currentRef.current = 0;
      setDisplay(0);
      return;
    }

    if (prefersReducedMotion) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const controls = animate(currentRef.current, value, {
      type: 'spring',
      stiffness: 160,
      damping: 24,
      mass: 0.65,
      onUpdate: (latest) => {
        currentRef.current = latest;
        setDisplay(latest);
      },
    });

    return () => {
      controls.stop();
    };
  }, [value, prefersReducedMotion]);

  if (value === null) {
    return <span className={className}>{fallback}</span>;
  }

  const resolvedDecimals = adaptiveDecimals
    ? display >= 100
      ? 0
      : 1
    : decimals;

  const formatted = Math.max(0, display).toFixed(resolvedDecimals);

  return <span className={className}>{formatted}</span>;
};
