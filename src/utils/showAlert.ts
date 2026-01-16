import Swal from "sweetalert2"

export function showSuccessAlert(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Crear otro ticket",
    cancelButtonText: "Cerrar",
    confirmButtonColor: "#2563eb", // azul
    cancelButtonColor: "#6b7280",  // gris
    allowOutsideClick: true,
    allowEscapeKey: true,
  })
}
