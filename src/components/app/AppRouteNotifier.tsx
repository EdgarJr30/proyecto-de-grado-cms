import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { notifyNavigation } from '../../lib/dataInvalidation';

export default function AppRouteNotifier() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    notifyNavigation(`${location.pathname}${location.search}`);

    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (location.hash) {
      const hashTargetId = decodeURIComponent(location.hash.slice(1));
      window.requestAnimationFrame(() => {
        const target = document.getElementById(hashTargetId);
        if (target) {
          target.scrollIntoView({ behavior, block: 'start' });
        }
      });
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior });
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    prefersReducedMotion,
  ]);

  return null;
}
