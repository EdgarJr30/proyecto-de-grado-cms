export const MAX_TITLE_LENGTH = 60
export const MAX_DESCRIPTION_LENGTH = 200
export const MAX_REQUESTER_LENGTH = 30
export const MAX_EMAIL_LENGTH = 60
export const MAX_PHONE_LENGTH = 20
export const MAX_COMMENTS_LENGTH = 200

export function validateTitle(title: string): string | null {
  const trimmed = title.trim();

  if (!trimmed) return "El título es obligatorio.";

  if (trimmed.length < 4)
    return "El título debe tener al menos 4 caracteres.";

  if (trimmed.length > MAX_TITLE_LENGTH)
    return `El título no puede superar los ${MAX_TITLE_LENGTH} caracteres.`;

  // Debe tener al menos una palabra real (2+ letras)
  if (!/\b[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]{2,}\b/.test(trimmed))
    return "El título debe incluir al menos una palabra con más de una letra.";

  // No debe ser solo puntuación o símbolos
  if (/^[\s\p{P}]+$/u.test(trimmed))
    return "El título no puede contener solo signos o símbolos.";

  // Debe contener vocales, para evitar texto sin sentido como "kjdshf"
  const hasVowel = /[aeiouáéíóúü]/i.test(trimmed);
  if (!hasVowel)
    return "El título debe contener palabras válidas con vocales.";

  // No debe contener muy poca variedad de caracteres (evita "aaa", "abcabc")
  const distinctChars = new Set(trimmed.replace(/\s/g, "").toLowerCase());
  if (distinctChars.size < 4)
    return "El título debe tener más variedad de caracteres.";

  // Si tiene 2 o más palabras, verificar que no sean todas iguales
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length >= 2) {
    const allSame = words.every((w) => w === words[0]);
    if (allSame)
      return "El título no debe repetir la misma palabra sin contexto.";
  }

  // Requiere al menos dos palabras para mayor claridad
  if (words.length < 2)
    return "El título debe tener al menos dos palabras.";

  return null;
}

export function validateDescription(description: string): string | null {
  const trimmed = description.trim();

  if (!trimmed) return "La descripción es obligatoria.";

  if (trimmed.length < 4)
    return "La descripción debe tener al menos 4 caracteres.";

  if (trimmed.length > MAX_DESCRIPTION_LENGTH)
    return `La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`;

  // Requiere al menos una palabra con 2 letras o más
  if (!/\b[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]{2,}\b/.test(trimmed))
    return "La descripción debe incluir palabras válidas con más de una letra.";

  // Debe tener vocales
  const hasVowel = /[aeiouáéíóúü]/i.test(trimmed);
  if (!hasVowel)
    return "La descripción debe contener palabras con vocales.";

  // Verificar que no todas las palabras sean iguales (si hay 2 o más)
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length >= 2) {
    const allSame = words.every((w) => w === words[0]);
    if (allSame)
      return "La descripción no debe repetir la misma palabra sin contexto.";
  }

  // Debe tener cierta variedad de caracteres
  const uniqueChars = new Set(trimmed.replace(/\s/g, "").toLowerCase());
  if (uniqueChars.size < 4)
    return "La descripción debe tener más variedad de caracteres.";

  return null;
}

export function validateRequester(requester: string): string | null {
  const trimmed = requester.trim();

  if (!trimmed) return "El nombre del solicitante es obligatorio.";

  if (trimmed.length > MAX_REQUESTER_LENGTH)
    return `El nombre no puede superar los ${MAX_REQUESTER_LENGTH} caracteres.`;

  const validCharsRegex = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ0-9\s]+$/;
  if (!validCharsRegex.test(trimmed))
    return "El nombre solo debe contener letras y espacios. No se permiten símbolos ni números.";

  const words = trimmed.split(/\s+/);

  if (words.length < 2)
    return "Escribe el nombre completo (nombre y apellido).";

  // No se permite repetir la misma palabra exacta
  const normalizedWords = words.map(w => w.toLowerCase());
  const uniqueWords = new Set(normalizedWords);
  if (uniqueWords.size < words.length)
    return "El nombre no debe contener palabras repetidas.";

  return null;
}

export function validateLocation(location: string): string | null {
  if (!location) return "La ubicación es obligatoria."
  return null
}

export function validateIncidentDate(date: string): string | null {
  if (!date) return "La fecha del incidente es obligatoria.";

  const inputDate = new Date(date);
  const today = new Date();

  // Normalizar ambos para comparar solo la fecha (sin horas)
  inputDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (isNaN(inputDate.getTime())) {
    return "La fecha del incidente no es válida.";
  }

  if (inputDate > today) {
    return "La fecha del incidente no puede ser mayor a la fecha actual.";
  }

  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  // Si está vacío, no se valida (es opcional)
  if (!trimmed) return null;

  if (trimmed.length > MAX_EMAIL_LENGTH)
    return `El correo no puede superar los ${MAX_EMAIL_LENGTH} caracteres.`;

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed))
    return "Formato de correo inválido. Usa solo letras, números, puntos, guiones y una extensión válida.";

  const [local, domain] = trimmed.split("@");
  if (!local || !domain)
    return "Formato de correo inválido.";

  if (local.startsWith(".") || local.endsWith("."))
    return "El nombre de usuario no puede comenzar ni terminar con punto.";

  if (local.includes(".."))
    return "El nombre de usuario no puede tener puntos consecutivos.";

  return null;
}

export function validatePhone(phone?: string): string | null {
  if (!phone || !phone.trim()) return null;

  const trimmed = phone.trim();

  if (trimmed.length > MAX_PHONE_LENGTH)
    return `El teléfono no puede superar los ${MAX_PHONE_LENGTH} caracteres.`;

  // Solo se permiten números, espacios, paréntesis, guiones y + al inicio
  const validFormat = /^(\+)?[0-9\s\-()]+$/;
  if (!validFormat.test(trimmed))
    return "Formato de teléfono inválido. Usa solo números, espacios, guiones, paréntesis y un '+' opcional al inicio.";

  // No puede tener múltiples símbolos +
  if ((trimmed.match(/\+/g) || []).length > 1 || (trimmed.includes("+") && !trimmed.startsWith("+")))
    return "El símbolo '+' solo puede estar al inicio del número.";

  // Extraer solo los dígitos reales
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10)
    return "El teléfono debe tener al menos 10 dígitos.";

  return null;
}

export function validateComments(comments: string): string | null {
  const trimmed = comments.trim();

  if (!trimmed) return null;

  if (trimmed.length < 4)
    return "Los comentarios deben tener al menos 4 caracteres.";

  if (trimmed.length > MAX_COMMENTS_LENGTH)
    return `Los comentarios no pueden superar los ${MAX_COMMENTS_LENGTH} caracteres.`;

  // Requiere al menos una palabra con 2 letras o más
  if (!/\b[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]{2,}\b/.test(trimmed))
    return "Los comentarios deben incluir palabras válidas con más de una letra.";

  // Debe tener vocales
  const hasVowel = /[aeiouáéíóúü]/i.test(trimmed);
  if (!hasVowel)
    return "Los comentarios deben contener palabras con vocales.";

  // Verificar que no todas las palabras sean iguales (si hay 2 o más)
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length >= 2) {
    const allSame = words.every((w) => w === words[0]);
    if (allSame)
      return "Los comentarios no deben repetir la misma palabra sin contexto.";
  }

  // Debe tener cierta variedad de caracteres
  const uniqueChars = new Set(trimmed.replace(/\s/g, "").toLowerCase());
  if (uniqueChars.size < 4)
    return "Los comentarios deben tener más variedad de caracteres.";

  return null;
}
