import LocationsSettings from './LocationsSettings';
import { useCan } from '../../../../rbac/PermissionsContext';

export default function GeneralSettings() {
  const canLocationsRead = useCan('locations:read');
  const canLocationsFull = useCan('locations:full_access');
  const canLocationsDisable = useCan('locations:disable');
  const canLocationsDelete = useCan('locations:delete');

  const canManageLocations =
    canLocationsFull ||
    canLocationsDisable ||
    canLocationsDelete ||
    canLocationsRead;

  const canSeeAnything = canManageLocations;

  if (!canSeeAnything) {
    return (
      <div className="p-4 md:p-6 rounded-lg border bg-white shadow-sm">
        No tienes permiso para ver ninguna opción de configuración general.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManageLocations && <LocationsSettings />}
    </div>
  );
}
