"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { swalSuccess, swalError, swalInfo } from "@/lib/swal";

export default function PerfilPage() {
  const { user, refresh, loading } = useUser();
  const [saving, setSaving] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [form, setForm] = useState({
    perfil: {
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      titulo: "",
      cedula_profesional: "",
      firma: "",
      firma_digital: "",
    },
    contactos: {
      telefono: "",
      celular: "",
    },
    direccion: {
      direccion: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      pais: "",
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [twoFA, setTwoFA] = useState({ enable: false, code: "", otpauth: "" });
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      perfil: {
        nombre: user.perfil?.nombre || "",
        apellido_paterno: user.perfil?.apellido_paterno || "",
        apellido_materno: user.perfil?.apellido_materno || "",
        titulo: user.perfil?.titulo || "",
        cedula_profesional: user.perfil?.cedula_profesional || "",
        firma: user.perfil?.firma || "",
        firma_digital: user.perfil?.firma_digital || "",
      },
      contactos: {
        telefono: user.contactos?.telefono || "",
        celular: user.contactos?.celular || "",
      },
      direccion: {
        direccion: user.direccion?.direccion || "",
        ciudad: user.direccion?.ciudad || "",
        estado: user.direccion?.estado || "",
        codigo_postal: user.direccion?.codigo_postal || "",
        pais: user.direccion?.pais || "",
      },
    });
    setTwoFA((prev: any) => ({ ...prev, enable: !!user.two_factor_enabled }));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function genQR() {
      if (!twoFA.otpauth) {
        setQrDataUrl("");
        return;
      }
      try {
        const qr = await import("qrcode");
        const url = await qr.toDataURL(twoFA.otpauth);
        if (!cancelled) setQrDataUrl(url);
      } catch (err: any) {
        if (!cancelled) {
          setQrDataUrl("");
          swalError("No se pudo generar el QR localmente");
        }
      }
    }
    genQR();
    return () => {
      cancelled = true;
    };
  }, [twoFA.otpauth]);

  const onChange = (
    section: "perfil" | "contactos" | "direccion",
    field: string,
    value: string
  ) => {
    setForm((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleFirmaFile = (field: "firma" | "firma_digital", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen (PNG, JPG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") setForm((prev: any) => ({
        ...prev,
        perfil: { ...prev.perfil, [field]: result },
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearFirma = (field: "firma" | "firma_digital") => {
    setForm((prev: any) => ({
      ...prev,
      perfil: { ...prev.perfil, [field]: "" },
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiService.updateMe(form);
      await refresh();
      await swalSuccess("Perfil actualizado");
    } catch (err: any) {
      swalError(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSecurity(true);
    try {
      // Cambiar contraseña si viene
      if (passwordForm.current_password && passwordForm.new_password) {
        if (passwordForm.new_password !== passwordForm.confirm_new_password) {
          swalError("Las contraseñas no coinciden");
          setSavingSecurity(false);
          return;
        }
        await apiService.changePassword(
          passwordForm.current_password,
          passwordForm.new_password
        );
        setPasswordForm({
          current_password: "",
          new_password: "",
          confirm_new_password: "",
        });
        await swalSuccess("Contraseña actualizada");
      }

      // Toggle 2FA si cambió el switch (sin requerir código)
      if (twoFA.enable !== !!user.two_factor_enabled) {
        await apiService.toggle2FA(twoFA.enable);
        setTwoFA((prev) => ({ ...prev, enable: twoFA.enable, code: "" }));
        await refresh();
        await swalSuccess("Estado de 2FA actualizado");
      }
    } catch (err: any) {
      swalError(err.response?.data?.detail || "Error en seguridad");
    } finally {
      setSavingSecurity(false);
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl bg-degradado-primario text-white shadow">
        <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/25 grid place-items-center text-2xl font-semibold">
              <span>
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">
                {user.full_name || user.email}
              </h1>
              <p className="text-white/80 text-sm md:text-base">
                {user.rol?.nombre || "Sin rol"} ·{" "}
                {user.empresa?.nombre || "Sin empresa"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  user.is_active ? "bg-green-300" : "bg-red-300"
                }`}
              />
              {user.is_active ? "Cuenta activa" : "Cuenta inactiva"}
            </span>
            <span className="hidden sm:inline text-white/80">|</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
              2FA: {user.two_factor_enabled ? "Habilitado" : "Deshabilitado"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-black/5">
          <h3 className="font-semibold mb-2">Cuenta</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Correo: <span className="text-gray-900">{user.email}</span>
            </p>
            <p>
              2FA:{" "}
              <span className="text-gray-900">
                {user.two_factor_enabled ? "Habilitado" : "Deshabilitado"}
              </span>
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-black/5">
          <h3 className="font-semibold mb-2">Empresa</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Nombre:{" "}
              <span className="text-gray-900">
                {user.empresa?.nombre || "N/A"}
              </span>
            </p>
            <p>
              Dominio:{" "}
              <span className="text-gray-900">
                {user.empresa?.dominio || "N/A"}
              </span>
            </p>
            <p>
              Activa:{" "}
              <span className="text-gray-900">
                {user.empresa?.activo ? "Sí" : "No"}
              </span>
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-black/5">
          <h3 className="font-semibold mb-2">Rol</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Rol:{" "}
              <span className="text-gray-900">{user.rol?.nombre || "N/A"}</span>
            </p>
            <p>
              Nivel:{" "}
              <span className="text-gray-900">{user.rol?.nivel ?? "N/A"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5">
        <form
          className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
          onSubmit={onSubmit}
        >
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Datos personales</h2>
              <p className="text-sm text-gray-500">
                Información básica de tu perfil
              </p>
            </div>
            <Input
              label="Nombre"
              name="nombre"
              value={form.perfil.nombre}
              onChange={(e) => onChange("perfil", "nombre", e.target.value)}
            />
            <Input
              label="Apellido paterno"
              name="apellido_paterno"
              value={form.perfil.apellido_paterno}
              onChange={(e) =>
                onChange("perfil", "apellido_paterno", e.target.value)
              }
            />
            <Input
              label="Apellido materno"
              name="apellido_materno"
              value={form.perfil.apellido_materno}
              onChange={(e) =>
                onChange("perfil", "apellido_materno", e.target.value)
              }
            />
            <Input
              label="Título"
              name="titulo"
              value={form.perfil.titulo}
              onChange={(e) => onChange("perfil", "titulo", e.target.value)}
            />
            <Input
              label="Cédula profesional"
              name="cedula_profesional"
              value={form.perfil.cedula_profesional}
              onChange={(e) =>
                onChange("perfil", "cedula_profesional", e.target.value)
              }
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Contacto</h2>
              <p className="text-sm text-gray-500">
                Cómo pueden comunicarse contigo
              </p>
            </div>
            <Input
              label="Teléfono"
              name="telefono"
              value={form.contactos.telefono}
              onChange={(e) =>
                onChange("contactos", "telefono", e.target.value)
              }
            />
            <Input
              label="Celular"
              name="celular"
              value={form.contactos.celular}
              onChange={(e) => onChange("contactos", "celular", e.target.value)}
            />
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div>
              <h2 className="font-semibold">Dirección</h2>
              <p className="text-sm text-gray-500">Tu ubicación principal</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Dirección"
                name="direccion"
                value={form.direccion.direccion}
                onChange={(e) =>
                  onChange("direccion", "direccion", e.target.value)
                }
              />
              <Input
                label="Ciudad"
                name="ciudad"
                value={form.direccion.ciudad}
                onChange={(e) =>
                  onChange("direccion", "ciudad", e.target.value)
                }
              />
              <Input
                label="Estado"
                name="estado"
                value={form.direccion.estado}
                onChange={(e) =>
                  onChange("direccion", "estado", e.target.value)
                }
              />
              <Input
                label="Código postal"
                name="codigo_postal"
                value={form.direccion.codigo_postal}
                onChange={(e) =>
                  onChange("direccion", "codigo_postal", e.target.value)
                }
              />
              <Input
                label="País"
                name="pais"
                value={form.direccion.pais}
                onChange={(e) => onChange("direccion", "pais", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div>
              <h2 className="font-semibold">Firmas</h2>
              <p className="text-sm text-gray-500">
                Imágenes de firma para documentos y correos
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4 bg-gray-50/50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firma física
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Firma literal que puede usarse en documentos y PDFs.
                </p>
                {form.perfil.firma ? (
                  <div className="flex flex-col gap-2">
                    <img src={form.perfil.firma} alt="Firma" className="max-h-20 w-auto object-contain border rounded" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => clearFirma("firma")}>
                      Quitar firma física
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                      onChange={(e) => handleFirmaFile("firma", e)}
                    />
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-4 bg-gray-50/50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firma digital
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Se incluye al final de cada correo que envíes desde la plataforma.
                </p>
                {form.perfil.firma_digital ? (
                  <div className="flex flex-col gap-2">
                    <img src={form.perfil.firma_digital} alt="Firma digital" className="max-h-20 w-auto object-contain border rounded" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => clearFirma("firma_digital")}>
                      Quitar firma digital
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                      onChange={(e) => handleFirmaFile("firma_digital", e)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-3 pt-2">
            <Button type="submit" variant="primary" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5">
        <form
          className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
          onSubmit={onSubmitSecurity}
        >
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Seguridad</h2>
              <p className="text-sm text-gray-500">
                Contraseña y autenticación de dos factores
              </p>
            </div>
            <Input
              label="Contraseña actual"
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  current_password: e.target.value,
                })
              }
            />
            <Input
              label="Nueva contraseña"
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  new_password: e.target.value,
                })
              }
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              name="confirm_new_password"
              value={passwordForm.confirm_new_password}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  confirm_new_password: e.target.value,
                })
              }
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-medium">
                  Autenticación de dos factores (2FA)
                </h3>
                <p className="text-sm text-gray-500">
                  Protege tu cuenta con un código TOTP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTwoFA((s) => ({ ...s, enable: !s.enable }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  twoFA.enable ? "bg-azul" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFA.enable ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {twoFA.enable && (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-sm text-gray-600">
                    <p className="mb-2">1) Presiona "Mostrar QR/clave"</p>
                    <p className="mb-2">
                      2) Escanéalo con tu app de autenticación
                    </p>
                    <p className="mb-2">
                      3) Guarda seguridad para aplicar cambios
                    </p>
                    <p className="text-xs text-gray-500">
                      Nota: Se te pedirá el código 2FA en tu próximo inicio de
                      sesión.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const data = await apiService.getOtpAuthUrl();
                            setTwoFA((s) => ({
                              ...s,
                              otpauth: data.otpauth_url,
                            }));
                            await swalInfo("Escanea el QR con tu app de autenticación");
                          } catch (err: any) {
                            swalError(err.response?.data?.detail || "No se pudo generar el QR");
                          }
                        }}
                        className="text-azul underline"
                      >
                        Mostrar QR/clave
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const data = await apiService.getOtpAuthUrl();
                            setTwoFA((s) => ({
                              ...s,
                              otpauth: data.otpauth_url,
                            }));
                            await swalSuccess("QR refrescado");
                          } catch (err: any) {
                            swalError(err.response?.data?.detail || "No se pudo refrescar el QR");
                          }
                        }}
                        className="text-azul underline"
                      >
                        Refrescar QR
                      </button>
                      <button
                        type="button"
                        disabled={!qrDataUrl}
                        onClick={async () => {
                          try {
                            if (!qrDataUrl) return;
                            const link = document.createElement("a");
                            link.href = qrDataUrl;
                            link.download = "2fa-qr.png";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            } catch (_) {
                            swalError("No se pudo descargar el QR");
                          }
                        }}
                        className="text-azul underline disabled:opacity-50"
                      >
                        Descargar QR
                      </button>
                    </div>
                    {twoFA.otpauth && (
                      <div className="mt-2 flex flex-col md:flex-row items-start md:items-center gap-4">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="QR 2FA"
                            className="rounded border border-gray-200 w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52"
                          />
                        ) : (
                          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 grid place-items-center rounded border border-gray-200 text-xs text-gray-500">
                            Generando QR...
                          </div>
                        )}
                        <div className="text-xs break-all bg-gray-50 p-2 rounded border border-gray-200 flex-1 max-w-full overflow-auto">
                          {twoFA.otpauth}
                          <div className="mt-2">
                            <button
                              type="button"
                              className="text-azul underline"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    twoFA.otpauth
                                  );
                                  await swalSuccess("Clave copiada al portapapeles");
                                } catch (_) {
                                  swalError("No se pudo copiar");
                                }
                              }}
                            >
                              Copiar clave
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {!twoFA.enable && user.two_factor_enabled && (
              <p className="text-sm text-gray-500">
                Desactivar 2FA no requiere código
              </p>
            )}
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-3 pt-2">
            <Button type="submit" variant="primary" loading={savingSecurity}>
              Guardar seguridad
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
