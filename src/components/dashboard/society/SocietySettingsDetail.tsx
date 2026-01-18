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
      {/* card centrada pero NO gigante */}
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-6">
        <div className="rounded-2xl border bg-white shadow-sm ring-1 ring-black/5">
          {/* Header (tamaño normal) */}
          <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Configuración de la Empresa
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500">
              Personaliza los parámetros básicos de tu empresa.
            </p>
          </div>

          <form onSubmit={onSave} className="px-4 sm:px-6 pb-6 sm:pb-8">
            {isLoading ? (
              <div className="py-10 text-center text-gray-400">Cargando…</div>
            ) : !canRead ? (
              <div className="py-10 text-center text-gray-400">
                No tienes permisos para ver esta configuración.
              </div>
            ) : (
              <div className="space-y-6">
                {/* ============== LOGO ============== */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl border bg-white shadow-sm overflow-hidden flex items-center justify-center">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt="Logo de la empresa"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold">
                          {initial}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        Logo de la empresa
                      </div>
                      <div className="mt-0.5 text-sm text-gray-500">
                        Recomendado: cuadrado, fondo limpio.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
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
                      className="inline-flex w-full sm:w-auto justify-center rounded-xl border px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Cambiar logo
                    </button>

                    {(logoFile || form.logo_url) && (
                      <button
                        type="button"
                        disabled={!canEdit || submitting}
                        className="inline-flex w-full sm:w-auto justify-center rounded-xl border px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                          setForm((f) => ({ ...f, logo_url: null }));
                          if (logoInputRef.current)
                            logoInputRef.current.value = '';
                        }}
                        title="Quitar logo (se aplica al Guardar)"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>

                {/* ============== IMAGEN LOGIN ============== */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-28 sm:w-32 rounded-2xl border bg-white shadow-sm overflow-hidden flex items-center justify-center">
                      {loginImgSrc ? (
                        <img
                          src={loginImgSrc}
                          alt="Imagen del login"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
                          Sin imagen
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        Imagen del login
                      </div>
                      <div className="mt-0.5 text-sm text-gray-500">
                        Recomendado: horizontal (banner) con buena luz.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
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
                      className="inline-flex w-full sm:w-auto justify-center rounded-xl border px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => loginImgInputRef.current?.click()}
                    >
                      Cambiar imagen
                    </button>

                    {(loginImgFile || form.login_img_url) && (
                      <button
                        type="button"
                        disabled={!canEdit || submitting}
                        className="inline-flex w-full sm:w-auto justify-center rounded-xl border px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
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
                </div>

                {/* Nombre */}
                <div>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      <span className="text-gray-500">▮▮</span>
                    </span>

                    <label className="text-lg font-semibold text-gray-600">
                      Nombre de la empresa
                    </label>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-200">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                        🧾
                      </span>

                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Empresa S.A."
                        maxLength={120}
                        disabled={!canEdit || submitting}
                        className="w-full bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Empresa activa */}
                <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-4 py-3">
                  <div className="pr-4">
                    <div className="text-sm font-semibold text-gray-900">
                      Empresa activa
                    </div>
                    <div className="text-sm text-gray-500">
                      Desactiva para ocultarla del sistema.
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canEdit || submitting}
                    onClick={() =>
                      setForm((f) => ({ ...f, is_active: !f.is_active }))
                    }
                    className={cx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition',
                      form.is_active ? 'bg-indigo-600' : 'bg-gray-300',
                      (!canEdit || submitting) &&
                        'opacity-60 cursor-not-allowed'
                    )}
                    aria-pressed={form.is_active}
                    aria-label="Toggle activo"
                  >
                    <span
                      className={cx(
                        'inline-block h-4.5 w-4.5 transform rounded-full bg-white transition',
                        form.is_active ? 'translate-x-5.5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                {/* Botones (móvil: full width, desktop: derecha) */}
                <div className="pt-1 flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting || !isDirty}
                    className="inline-flex w-full sm:w-auto justify-center rounded-xl border px-5 py-2.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !canEdit || !isDirty}
                    className="inline-flex w-full sm:w-auto justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      !canEdit ? 'No tienes permiso para editar' : undefined
                    }
                  >
                    {submitting ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>

                {!society && (
                  <div className="text-sm text-gray-500">
                    No existe ninguna empresa creada todavía. Completa el nombre
                    y guarda para crearla.
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
