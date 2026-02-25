"use client";

import { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate?: Date;
  selectedSlot?: { start: Date; end: Date };
}

interface EventFormData {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  attendees: string; // Lista de emails separados por comas
}

export default function CreateEventModal({
  isOpen,
  onClose,
  onSuccess,
  selectedDate,
  selectedSlot,
}: CreateEventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    location: "",
    attendees: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar fechas cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const start = selectedSlot?.start || selectedDate || new Date();
      const end = selectedSlot?.end || new Date(start.getTime() + 60 * 60 * 1000); // +1 hora por defecto

      setFormData({
        title: "",
        description: "",
        startDate: formatDateForInput(start),
        startTime: formatTimeForInput(start),
        endDate: formatDateForInput(end),
        endTime: formatTimeForInput(end),
        location: "",
        attendees: "",
      });
      setError(null);
    }
  }, [isOpen, selectedDate, selectedSlot]);

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!window.gapi?.client?.calendar) {
        throw new Error("Google Calendar API no está inicializada");
      }

      if (!formData.title.trim()) {
        throw new Error("El título es requerido");
      }

      // Construir fechas ISO
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error("Fechas inválidas");
      }

      if (endDateTime <= startDateTime) {
        throw new Error("La fecha de fin debe ser posterior a la fecha de inicio");
      }

      // Preparar lista de asistentes
      const attendeesList = formData.attendees
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => ({ email }));

      // Crear el evento
      const event = {
        summary: formData.title,
        description: formData.description || undefined,
        location: formData.location || undefined,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendeesList.length > 0 ? attendeesList : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 día antes
            { method: "popup", minutes: 15 }, // 15 minutos antes
          ],
        },
      };

      const response = await window.gapi.client.calendar.events.insert({
        calendarId: "primary",
        resource: event,
      });

      if (response.status === 200) {
        onSuccess();
        onClose();
      } else {
        throw new Error("No se pudo crear el evento");
      }
    } catch (err: any) {
      console.error("Error al crear evento:", err);
      setError(err.message || "Error al crear el evento. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Nueva Reunión</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Reunión con cliente"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Descripción
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Agregar detalles de la reunión..."
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Fecha de inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  required
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Hora de inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="startTime"
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Fecha de fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="endDate"
                  required
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Hora de fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="endTime"
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Ubicación
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Oficina principal, Zoom, etc."
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="attendees"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Asistentes (emails separados por comas)
              </label>
              <input
                type="text"
                id="attendees"
                value={formData.attendees}
                onChange={(e) =>
                  setFormData({ ...formData, attendees: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ejemplo1@email.com, ejemplo2@email.com"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Separa múltiples emails con comas
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {loading ? "Creando..." : "Crear Reunión"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

