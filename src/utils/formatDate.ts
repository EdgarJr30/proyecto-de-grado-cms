import { toZonedTime, format } from "date-fns-tz";

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
};

export const formatDateTimeLocal = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
};

/**
 * Devuelve la fecha y hora actual en una zona horaria específica
 * en formato 'yyyy-MM-ddTHH:mm:ss' (sin Z), ideal para almacenar.
 */
export const getNowInTimezoneForStorage = (tz: string = "America/Santo_Domingo"): string => {
  const now = new Date()
  const zoned = toZonedTime(now, tz)
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss", { timeZone: tz }) // SIN "Z"
}

export const formatDateInTimezone = (
  dateStr: string,
  tz: string = "America/Santo_Domingo",
  mode: "input" | "display" = "display"
): string => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const zoned = toZonedTime(date, tz);

  if (mode === "input") {
    return format(zoned, "yyyy-MM-dd'T'HH:mm:ss", { timeZone: tz });
  }

  return format(zoned, "dd/MM/yyyy HH:mm:ss", { timeZone: tz });
};

export function getTodayISODate(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}