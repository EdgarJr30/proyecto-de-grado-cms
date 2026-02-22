import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { notifyNavigation } from '../../lib/dataInvalidation';

export default function AppRouteNotifier() {
  const location = useLocation();

  useEffect(() => {
    notifyNavigation(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}
