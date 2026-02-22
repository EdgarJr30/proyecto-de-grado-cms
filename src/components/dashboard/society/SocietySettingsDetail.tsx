import { useEffect, useMemo, useRef, useState } from 'react';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';
import {
  EMPTY_SOCIETY_FORM,
  type Society,
  type SocietyFormState,
} from '../../../types/Society';
import {
  getLatestSociety,
  createSociety,
  updateSociety,
} from '../../../services/societyService';
import imageCompression from 'browser-image-compression';
import {
  uploadSocietyBrandingImage,
  getBrandingPublicUrl,
} from '../../../services/brandingStorageService';

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function compressToWebp(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.85,
  };

  const compressed = await imageCompression(file, options);

  // Renombra a .webp
  return new File([compressed], file.name.replace(/\.\w+$/, '.webp'), {
    type: 'image/webp',
  });
}

export default function SocietySettingsDetail() {
  const canSocietyRead = useCan('society:read');
  const canSocietyFull = useCan('society:full_access');

  const canRead = canSocietyRead || canSocietyFull;
  const canEdit = canSocietyFull;

  const [isLoading, setIsLoading] = useState(true);
  const [society, setSociety] = useState<Society | null>(null);

  const [form, setForm] = useState<SocietyFormState>(EMPTY_SOCIETY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Inputs separados
  const logoInputRef = useRef<HTMLInputElement>(null);
  const loginImgInputRef = useRef<HTMLInputElement>(null);

  // Files + previews (para ver antes de guardar)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginImgFile, setLoginImgFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loginPreview, setLoginPreview] = useState<string | null>(null);

  // const isEditing = useMemo(() => typeof form.id === 'number', [form.id]);
  const initial = useMemo(
    () => (form.name.trim()[0] || 'E').toUpperCase(),
    [form.name]
  );

  // URLs para pintar en UI (preview local tiene prioridad)
  const logoSrc = useMemo(() => {
    if (logoPreview) return logoPreview;
    if (form.logo_url) return getBrandingPublicUrl(form.logo_url);
    return null;
  }, [logoPreview, form.logo_url]);

  const loginImgSrc = useMemo(() => {
    if (loginPreview) return loginPreview;
    if (form.login_img_url) return getBrandingPublicUrl(form.login_img_url);
    return null;
  }, [loginPreview, form.login_img_url]);

  const isDirty = useMemo(() => {
    const baseDirty = !society
      ? form.name.trim() !== '' ||
        form.logo_url !== null ||
        form.login_img_url !== null ||
        form.is_active !== true
      : form.name !== society.name ||
        (form.logo_url ?? null) !== (society.logo_url ?? null) ||
        (form.login_img_url ?? null) !== (society.login_img_url ?? null) ||
        form.is_active !== society.is_active;

    // Si seleccionaste archivos nuevos, también cuenta como dirty
    return baseDirty || !!logoFile || !!loginImgFile;
  }, [form, society, logoFile, loginImgFile]);

  async function loadLatestSociety() {
    if (!canRead) {
      setSociety(null);
      setForm(EMPTY_SOCIETY_FORM);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const s = await getLatestSociety();
      setSociety(s);

      if (!s) {
        setForm(EMPTY_SOCIETY_FORM);
      } else {
        setForm({
          id: s.id,
          name: s.name,
          logo_url: s.logo_url,
          login_img_url: s.login_img_url,
          is_active: s.is_active,
        });
      }
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando sociedad'
      );
      setSociety(null);
      setForm(EMPTY_SOCIETY_FORM);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLatestSociety();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function onCancel() {
    // Revertir form a lo que está en DB (si existe)
    if (!society) {
      setForm(EMPTY_SOCIETY_FORM);
    } else {
      setForm({
        id: society.id,
        name: society.name,
        logo_url: society.logo_url,
        login_img_url: society.login_img_url,
        is_active: society.is_active,
      });
    }

    // Limpiar selección local
    setLogoFile(null);
    setLoginImgFile(null);
    setLogoPreview(null);
    setLoginPreview(null);

    // Reset input file (por si eliges el mismo archivo otra vez)
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (loginImgInputRef.current) loginImgInputRef.current.value = '';
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const webp = await compressToWebp(f);
      setLogoFile(webp);

      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(webp);
    } catch (err) {
      showToastError(`Error preparando el logo. ${String(err)}`);
      setLogoFile(null);
      setLogoPreview(null);
    }
  };

  const handleLoginImgChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const webp = await compressToWebp(f);
      setLoginImgFile(webp);

      const reader = new FileReader();
      reader.onload = () => setLoginPreview(reader.result as string);
      reader.readAsDataURL(webp);
    } catch (err) {
      showToastError(`Error preparando la imagen del login. ${String(err)}`);
      setLoginImgFile(null);
      setLoginPreview(null);
    }
  };

  async function onSave(e: React.FormEvent) {
    e.preventDefault();

    if (!canEdit) {
      showToastError('No tienes permiso para editar la configuración.');
      return;
    }

    const name = form.name.trim();
    if (!name) {
      showToastError('El nombre de la empresa es obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) Asegura societyId (crear si no existe)
      let societyId = form.id;

      if (!societyId) {
        const created = await createSociety({
          name,
          is_active: form.is_active,
        });
        societyId = created.id;
      }

      // 2) Subir imágenes si aplican
      let nextLogoPath = form.logo_url ?? null;
      let nextLoginPath = form.login_img_url ?? null;

      if (logoFile) {
        nextLogoPath = await uploadSocietyBrandingImage(
          logoFile,
          societyId,
          'logo'
        );
      }

      if (loginImgFile) {
        nextLoginPath = await uploadSocietyBrandingImage(
          loginImgFile,
          societyId,
          'login'
        );
      }

      // 3) Guardar en DB
      await updateSociety(societyId, {
        name,
        logo_url: nextLogoPath,
        login_img_url: nextLoginPath,
        is_active: form.is_active,
      });

      showToastSuccess('Configuración actualizada.');

      // Limpia selección local
      setLogoFile(null);
      setLoginImgFile(null);
      setLogoPreview(null);
      setLoginPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      if (loginImgInputRef.current) loginImgInputRef.current.value = '';

      await loadLatestSociety();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando la configuración'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-6 sm:px-8 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sociedad
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Configuración de la Empresa
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600">
              Personaliza el branding y los datos principales de la empresa que
              verán los usuarios.
            </p>
          </div>

          <form onSubmit={onSave} className="px-4 py-5 sm:px-8 sm:py-6">
            {isLoading ? (
              <div className="py-10 text-center text-slate-400">Cargando…</div>
            ) : !canRead ? (
              <div className="py-10 text-center text-slate-400">
                No tienes permisos para ver esta configuración.
              </div>
            ) : (
              <div className="space-y-6">
                <section className="grid gap-4 lg:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt="Logo de la empresa"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white">
                            {initial}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">
                          Logo de la empresa
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Recomendado: formato cuadrado, fondo limpio.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!canEdit || submitting}
                        onChange={(e) => void handleLogoChange(e)}
                      />
                      <button
                        type="button"
                        disabled={!canEdit || submitting}
                        className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        Cambiar logo
                      </button>

                      {(logoFile || form.logo_url) && (
                        <button
                          type="button"
                          disabled={!canEdit || submitting}
                          className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(null);
                            setForm((f) => ({ ...f, logo_url: null }));
                            if (logoInputRef.current) logoInputRef.current.value = '';
                          }}
                          title="Quitar logo (se aplica al Guardar)"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-32">
                        {loginImgSrc ? (
                          <img
                            src={loginImgSrc}
                            alt="Imagen del login"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-xs text-slate-400">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">
                          Imagen del login
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Recomendado: banner horizontal con buena iluminación.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        ref={loginImgInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!canEdit || submitting}
                        onChange={(e) => void handleLoginImgChange(e)}
                      />
                      <button
                        type="button"
                        disabled={!canEdit || submitting}
                        className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => loginImgInputRef.current?.click()}
                      >
                        Cambiar imagen
                      </button>

                      {(loginImgFile || form.login_img_url) && (
                        <button
                          type="button"
                          disabled={!canEdit || submitting}
                          className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={() => {
                            setLoginImgFile(null);
                            setLoginPreview(null);
                            setForm((f) => ({ ...f, login_img_url: null }));
                            if (loginImgInputRef.current)
                              loginImgInputRef.current.value = '';
                          }}
                          title="Quitar imagen (se aplica al Guardar)"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </article>
                </section>

                <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label
                      htmlFor="society-name"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Nombre de la empresa
                    </label>
                    <input
                      id="society-name"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Empresa S.A."
                      maxLength={120}
                      disabled={!canEdit || submitting}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                    />
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">
                      Empresa activa
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Desactiva para ocultarla del sistema.
                    </p>
                    <div className="mt-4 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={!canEdit || submitting}
                        onClick={() =>
                          setForm((f) => ({ ...f, is_active: !f.is_active }))
                        }
                        className={cx(
                          'relative inline-flex h-7 w-12 items-center rounded-full transition',
                          form.is_active ? 'bg-indigo-600' : 'bg-slate-300',
                          (!canEdit || submitting) &&
                            'opacity-60 cursor-not-allowed'
                        )}
                        role="switch"
                        aria-checked={form.is_active}
                        aria-label="Empresa activa"
                      >
                        <span
                          className={cx(
                            'inline-block h-5 w-5 transform rounded-full bg-white transition',
                            form.is_active ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </div>
                  </article>
                </section>

                {!society && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No existe ninguna empresa creada todavía. Completa el nombre
                    y guarda para crearla.
                  </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting || !isDirty}
                    className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !canEdit || !isDirty}
                    className="inline-flex w-full justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                    title={!canEdit ? 'No tienes permiso para editar' : undefined}
                  >
                    {submitting ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
