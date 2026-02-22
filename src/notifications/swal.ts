import Swal from 'sweetalert2';

type ConfirmAlertOptions = {
  title: string;
  text: string;
  icon?: 'warning' | 'question' | 'error' | 'info' | 'success';
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
};

export async function showConfirmAlert(
  options: ConfirmAlertOptions
): Promise<boolean> {
  const {
    title,
    text,
    icon = 'warning',
    confirmButtonText = 'Sí, continuar',
    cancelButtonText = 'Cancelar',
    confirmButtonColor = '#dc2626',
    cancelButtonColor = '#6b7280',
  } = options;

  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor,
    cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: true,
  });

  return result.isConfirmed === true;
}

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
  });
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
  return showConfirmAlert({
    title: '¿Archivar orden?',
    text: `La orden #${id} pasará a "Archivadas".`,
    confirmButtonText: 'Sí, archivar',
    confirmButtonColor: '#334155',
    cancelButtonColor: '#9ca3af',
  });
}
