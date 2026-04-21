"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { swalSuccess, swalError, swalInfo } from "@/lib/swal";
import { getUserDisplayName, getUserInitial } from "@/lib/userName";
import { compressImageFileToDataUrl } from "@/lib/imageDataUrl";

export default function PerfilPage() {
  const { user, refresh, loading } = useUser();
  const canEditFullProfile = user?.rol?.nivel === 0 || user?.rol?.nivel === 1;
  const [saving, setSaving] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [form, setForm] = useState({
    perfil: {
      foto_de_perfil: "",
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
  const inputFotoPerfilRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      perfil: {
        foto_de_perfil: user.perfil?.foto_de_perfil || "",
        nombre: user.perfil?.nombre || user.nombre || "",
        apellido_paterno:
          user.perfil?.apellido_paterno || user.apellido_paterno || "",
        apellido_materno:
          user.perfil?.apellido_materno || user.apellido_materno || "",
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
    value: string,
  ) => {
    if (!canEditFullProfile) return;
    setForm((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleFotoPerfilFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen (PNG, JPG, etc.)");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: 960,
        mime: "image/jpeg",
        quality: 0.82,
      });
      setForm((prev: any) => ({
        ...prev,
        perfil: { ...prev.perfil, foto_de_perfil: dataUrl },
      }));
    } catch {
      swalError(
        "No se pudo procesar la foto. Prueba con otra imagen o un archivo más pequeño.",
      );
    }
    e.target.value = "";
  };

  const handleFirmaFile = async (
    field: "firma" | "firma_digital",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!canEditFullProfile) {
      swalError("Solo los roles nivel 0 o 1 pueden editar firmas.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen (PNG, JPG, etc.)");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: 1400,
        mime: "image/jpeg",
        quality: 0.88,
      });
      setForm((prev: any) => ({
        ...prev,
        perfil: { ...prev.perfil, [field]: dataUrl },
      }));
    } catch {
      swalError(
        "No se pudo procesar la imagen de firma. Prueba con otro archivo.",
      );
    }
    e.target.value = "";
  };

  const clearFirma = (field: "firma" | "firma_digital") => {
    if (!canEditFullProfile) return;
    setForm((prev: any) => ({
      ...prev,
      perfil: { ...prev.perfil, [field]: "" },
    }));
  };

  const clearFotoPerfil = () => {
    setForm((prev: any) => ({
      ...prev,
      perfil: { ...prev.perfil, foto_de_perfil: "" },
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const orig = user.perfil;
      const p = form.perfil;
      const perfilPayload: Record<string, string> = {
        nombre: (p.nombre || "").trim(),
        apellido_paterno: (p.apellido_paterno || "").trim(),
        apellido_materno: (p.apellido_materno || "").trim(),
        titulo: (p.titulo || "").trim(),
        cedula_profesional: (p.cedula_profesional || "").trim(),
      };
      if ((p.foto_de_perfil || "") !== (orig?.foto_de_perfil || "")) {
        perfilPayload.foto_de_perfil = p.foto_de_perfil || "";
      }
      if ((p.firma || "") !== (orig?.firma || "")) {
        perfilPayload.firma = p.firma || "";
      }
      if ((p.firma_digital || "") !== (orig?.firma_digital || "")) {
        perfilPayload.firma_digital = p.firma_digital || "";
      }
      const payload = canEditFullProfile
        ? {
            perfil: perfilPayload,
            contactos: form.contactos,
            direccion: form.direccion,
          }
        : {
            perfil: {
              foto_de_perfil:
                perfilPayload.foto_de_perfil ?? (p.foto_de_perfil || ""),
            },
          };

      await apiService.updateMe(payload);
      await refresh();
      await swalSuccess("Perfil actualizado");
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 413) {
        swalError(
          "El servidor rechazó la petición por tamaño (413). Si subiste foto o firmas, usa imágenes más pequeñas. " +
            "Si el error persiste, el administrador debe aumentar el límite del cuerpo HTTP en Apache (LimitRequestBody) o en el proxy.",
        );
      } else {
        swalError(err.response?.data?.detail || "Error al actualizar");
      }
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
          passwordForm.new_password,
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

  const profilePreviewUser = {
    ...user,
    perfil: {
      ...(user.perfil || {}),
      ...form.perfil,
    },
  };

  return (
    <div className="container-app w-full space-y-4 py-4 sm:space-y-6 sm:py-6">
      <div className="rounded-xl bg-degradado-primario text-white shadow">
        <div className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => inputFotoPerfilRef.current?.click()}
              className="w-16 h-16 rounded-full bg-white/25 overflow-hidden grid place-items-center text-2xl font-semibold shrink-0 cursor-pointer hover:ring-2 hover:ring-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-shadow"
              title="Cambiar foto de perfil"
            >
              {form.perfil.foto_de_perfil || user.perfil?.foto_de_perfil ? (
                <img
                  src={
                    form.perfil.foto_de_perfil ||
                    user.perfil?.foto_de_perfil ||
                    ""
                  }
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getUserInitial(profilePreviewUser)}</span>
              )}
            </button>
            <input
              ref={inputFotoPerfilRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Seleccionar foto de perfil"
              onChange={handleFotoPerfilFile}
            />
            <div className="min-w-0">
              <h1 className="text-fluid-xl font-bold leading-tight md:text-2xl">
                {getUserDisplayName(profilePreviewUser, user.email)}
              </h1>
              <p className="text-sm text-white/80 md:text-base break-words">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Foto de perfil
              </label>
              <p className="text-sm text-gray-500 mb-2">
                Se mostrará en el menú y en tu perfil. Formatos: PNG, JPG.
              </p>
              {form.perfil.foto_de_perfil ? (
                <div className="flex items-center gap-3">
                  <img
                    src={form.perfil.foto_de_perfil}
                    alt="Vista previa"
                    className="w-20 h-20 rounded-full object-cover border border-gray-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => inputFotoPerfilRef.current?.click()}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={clearFotoPerfil}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputFotoPerfilRef.current?.click()}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Seleccionar imagen
                </button>
              )}
            </div>
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
                    <img
                      src={form.perfil.firma}
                      alt="Firma"
                      className="max-h-20 w-auto object-contain border rounded"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => clearFirma("firma")}
                    >
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
                  Se incluye al final de cada correo que envíes desde la
                  plataforma.
                </p>
                {form.perfil.firma_digital ? (
                  <div className="flex flex-col gap-2">
                    <img
                      src={form.perfil.firma_digital}
                      alt="Firma digital"
                      className="max-h-20 w-auto object-contain border rounded"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => clearFirma("firma_digital")}
                    >
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

          {canEditFullProfile && (
            <div className="lg:col-span-2 flex items-center justify-end gap-3 pt-2">
              <Button type="submit" variant="primary" loading={saving}>
                Guardar cambios
              </Button>
            </div>
          )}
        </form>
      </div>

      {canEditFullProfile && (
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
                              await swalInfo(
                                "Escanea el QR con tu app de autenticación",
                              );
                            } catch (err: any) {
                              swalError(
                                err.response?.data?.detail ||
                                  "No se pudo generar el QR",
                              );
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
                              swalError(
                                err.response?.data?.detail ||
                                  "No se pudo refrescar el QR",
                              );
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
                                      twoFA.otpauth,
                                    );
                                    await swalSuccess(
                                      "Clave copiada al portapapeles",
                                    );
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
      )}
    </div>
  );
}
