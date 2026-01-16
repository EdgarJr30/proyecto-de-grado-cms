import { toast, type ToastOptions, type ToastContent } from "react-toastify";

/** Normaliza mensaje a string legible para consola */
function asText(msg: ToastContent) {
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

/** Toast de éxito con log */
export function showToastSuccess(message: ToastContent, opts?: ToastOptions) {
  console.log(`✅ [toast-success] ${asText(message)}`);
  return toast.success(message, opts);
}

/** Toast de error con log */
export function showToastError(message: ToastContent, opts?: ToastOptions) {
  console.error(`❌ [toast-error] ${asText(message)}`);
  return toast.error(message, opts);
}

/** Toast de info con log */
export function showToastInfo(message: ToastContent, opts?: ToastOptions) {
  console.info(`ℹ️ [toast-info] ${asText(message)}`);
  return toast.info(message, opts);
}

/** Toast de warning opcional con log */
export function showToastWarning(message: ToastContent, opts?: ToastOptions) {
  console.warn(`⚠️ [toast-warning] ${asText(message)}`);
  return toast.warning(message, opts);
}
