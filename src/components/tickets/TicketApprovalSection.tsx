import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { getCurrentUserId } from '../../services/userService';
import { getPublicImageUrl } from '../../services/storageService';
import { showToastError, showToastSuccess } from '../../notifications';
import {
  getPendingApprovalForTicket,
  requestTicketApproval,
  decideTicketApproval,
  uploadApprovalEvidence,
  parseEvidencePaths,
  type ApprovalRequest,
} from '../../services/approvalService';

type Props = {
  ticketId: number;
  status: string;
  onChanged: () => void | Promise<void>;
};

export default function TicketApprovalSection({ ticketId, status, onChanged }: Props) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRequest, setShowRequest] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uid, req] = await Promise.all([
        getCurrentUserId(),
        getPendingApprovalForTicket(ticketId),
      ]);
      setCurrentUserId(uid);
      setPending(req);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudo cargar la validación.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRequest = useCallback(async () => {
    if (files.length === 0) {
      showToastError('Debes adjuntar al menos una imagen del trabajo terminado.');
      return;
    }
    setSubmitting(true);
    try {
      const paths = await uploadApprovalEvidence(ticketId, files);
      await requestTicketApproval({ ticketId, evidencePaths: paths, note: requestNote });
      showToastSuccess('Enviado a validación.');
      setShowRequest(false);
      setFiles([]);
      setRequestNote('');
      await load();
      await onChanged();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudo enviar a validación.');
    } finally {
      setSubmitting(false);
    }
  }, [files, ticketId, requestNote, load, onChanged]);

  const decide = useCallback(
    async (approve: boolean) => {
      if (!pending) return;
      if (!approve && decisionNote.trim().length === 0) {
        showToastError('Debes indicar un comentario para rechazar la solicitud.');
        return;
      }
      setDeciding(true);
      try {
        await decideTicketApproval({
          requestId: pending.id,
          approve,
          note: decisionNote,
        });
        showToastSuccess(approve ? 'Ticket validado y finalizado.' : 'Solicitud rechazada.');
        setDecisionNote('');
        await load();
        await onChanged();
      } catch (e) {
        showToastError(e instanceof Error ? e.message : 'No se pudo registrar la decisión.');
      } finally {
        setDeciding(false);
      }
    },
    [pending, decisionNote, load, onChanged]
  );

  if (loading) return null;
  if (status === 'Finalizadas' && !pending) return null;

  const evidencePaths = pending ? parseEvidencePaths(pending.evidence_image) : [];
  const viewerIsRequester = pending && currentUserId === pending.requester_user_id;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-300" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Validación de cierre
        </h3>
      </div>

      {pending ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
            En validación
          </p>

          {pending.note && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Nota del técnico:</span> {pending.note}
            </p>
          )}

          {evidencePaths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {evidencePaths.map((path) => (
                <a
                  key={path}
                  href={getPublicImageUrl(path)}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={getPublicImageUrl(path)}
                    alt="Evidencia"
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {viewerIsRequester ? (
            <p className="text-sm text-slate-500">
              Tu trabajo está en espera de validación por un aprobador.
            </p>
          ) : (
            <div className="space-y-2">
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                rows={2}
                placeholder="Comentario de la decisión (obligatorio si rechazas)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void decide(true)}
                  disabled={deciding}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  Validar y finalizar
                </button>
                <button
                  type="button"
                  onClick={() => void decide(false)}
                  disabled={deciding || decisionNote.trim().length === 0}
                  title={
                    decisionNote.trim().length === 0
                      ? 'Escribe un comentario para poder rechazar'
                      : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Para finalizar este ticket, envía tu trabajo a validación adjuntando una
            imagen del trabajo terminado.
          </p>

          {!showRequest ? (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              <Upload className="h-4 w-4" />
              Solicitar validación
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <label className="text-xs font-semibold text-slate-500">
                  Imagen del trabajo terminado (obligatoria)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="mt-1 block w-full text-sm"
                />
                {files.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {files.length} archivo(s) seleccionado(s).
                  </p>
                )}
              </div>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={2}
                placeholder="Nota para el aprobador (opcional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequest(false);
                    setFiles([]);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={submitting || files.length === 0}
                  className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Enviar a validación'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
