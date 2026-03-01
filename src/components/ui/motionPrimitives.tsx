import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type SpinProps = {
  className?: string;
  children?: ReactNode;
  duration?: number;
};

export function MotionSpin({
  className,
  children,
  duration = 1,
}: SpinProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={className}
      animate={{ rotate: 360 }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
    >
      {children}
    </motion.span>
  );
}

type PulseProps = {
  className?: string;
  children?: ReactNode;
  duration?: number;
  minOpacity?: number;
  maxOpacity?: number;
};

export function MotionPulse({
  className,
  children,
  duration = 1.25,
  minOpacity = 0.48,
  maxOpacity = 1,
}: PulseProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={{ opacity: [maxOpacity, minOpacity, maxOpacity] }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}
