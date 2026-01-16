import Swal from "sweetalert2";

export function showSuccessAlert(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Crear otro ticket",
    cancelButtonText: "Cerrar",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#6b7280",
    allowOutsideClick: true,
    allowEscapeKey: true,
  })
}

export function showErrorAlert(title: string, text: string) {
  return Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonText: "Cerrar",
    confirmButtonColor: "#e53e3e",
    allowOutsideClick: true,
    allowEscapeKey: true,
  });
}

export async function confirmArchiveWorkOrder(id: number): Promise<boolean> {
  const res = await Swal.fire({
    title: '¿Archivar orden?',
    text: `La orden #${id} pasará a "Archivadas".`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, archivar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#334155',
    cancelButtonColor: '#9ca3af',
    reverseButtons: true,
    focusCancel: true,
  });
  return res.isConfirmed === true;
}