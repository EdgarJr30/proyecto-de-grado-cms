import Swal from 'sweetalert2';

export async function confirmDeleteLine(lineNo?: number): Promise<boolean> {
  const res = await Swal.fire({
    title: '¿Quitar línea?',
    text: lineNo
      ? `Se eliminará la línea #${lineNo}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, quitar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#e11d48', // rose-600
    cancelButtonColor: '#64748b', // slate-500
    reverseButtons: true,
    focusCancel: true,
  });

  return res.isConfirmed === true;
}

export async function confirmDeleteDoc(
  docNo?: string | null
): Promise<boolean> {
  const res = await Swal.fire({
    title: '¿Eliminar documento?',
    text: docNo
      ? `Se eliminará el documento ${docNo} y todas sus líneas. Esta acción no se puede deshacer.`
      : 'Se eliminará el documento y todas sus líneas. Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    focusCancel: true,
  });

  return res.isConfirmed === true;
}

export async function confirmPostDoc(docNo?: string | null): Promise<boolean> {
  const res = await Swal.fire({
    title: 'Postear documento',
    text: docNo
      ? `Se afectará el stock al postear ${docNo}. ¿Deseas continuar?`
      : 'Se afectará el stock. ¿Deseas continuar?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, postear',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#16a34a', // green-600
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    focusCancel: true,
  });

  return res.isConfirmed === true;
}

export async function confirmCancelDoc(
  docNo?: string | null
): Promise<boolean> {
  const res = await Swal.fire({
    title: 'Cancelar documento',
    text: docNo
      ? `Se generará reversa para ${docNo} y se revertirá el stock. ¿Continuar?`
      : 'Se generará reversa y se revertirá el stock. ¿Continuar?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cancelar',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    focusCancel: true,
  });

  return res.isConfirmed === true;
}
