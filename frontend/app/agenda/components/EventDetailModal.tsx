"use client";

import type { ReactNode } from "react";
import { FiCalendar, FiClock, FiExternalLink, FiMapPin, FiUser, FiUsers, FiVideo, FiX } from "react-icons/fi";

interface EventDetail {
  title?: ReactNode;
  start?: Date;
  end?: Date;
  allDay?: boolean;
  description?: string;
  location?: string;
  htmlLink?: string;
  meetLink?: string;
  hangoutLink?: string;
  creatorEmail?: string;
  organizerEmail?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  calendarName?: string;
}

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventDetail | null;
}

const formatDateTime = (date?: Date) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const stripHtml = (value?: string) => {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
};

export default function EventDetailModal({
  isOpen,
  onClose,
  event,
}: EventDetailModalProps) {
  if (!isOpen || !event) return null;

  const meetLink = event.meetLink || event.hangoutLink;
  const description = stripHtml(event.description);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                <FiCalendar className="h-4 w-4" />
                {event.calendarName || "Google Calendar"}
              </p>
              <h2 className="break-words text-2xl font-bold text-gray-900">
                {String(event.title || "Reunión sin título")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Cerrar detalle de reunión"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <FiClock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Inicio</p>
                  <p className="text-sm text-gray-900">
                    {event.allDay ? "Todo el día" : formatDateTime(event.start)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <FiClock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Fin</p>
                  <p className="text-sm text-gray-900">
                    {event.allDay ? "Todo el día" : formatDateTime(event.end)}
                  </p>
                </div>
              </div>
            </div>

            {meetLink && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-800">
                  <FiVideo className="h-5 w-5" />
                  Google Meet
                </p>
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 break-all text-sm font-medium text-green-700 underline"
                >
                  {meetLink}
                  <FiExternalLink className="h-4 w-4 shrink-0" />
                </a>
              </div>
            )}

            {event.location && (
              <div className="flex gap-3">
                <FiMapPin className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Ubicación</p>
                  <p className="break-words text-sm text-gray-600">{event.location}</p>
                </div>
              </div>
            )}

            {description && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-900">Descripción</p>
                <p className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
                  {description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(event.organizerEmail || event.creatorEmail) && (
                <div className="flex gap-3">
                  <FiUser className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Organizador</p>
                    <p className="break-all text-sm text-gray-600">
                      {event.organizerEmail || event.creatorEmail}
                    </p>
                  </div>
                </div>
              )}

              {event.attendees && event.attendees.length > 0 && (
                <div className="flex gap-3">
                  <FiUsers className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Asistentes</p>
                    <div className="mt-1 space-y-1">
                      {event.attendees.map((attendee) => (
                        <p key={attendee.email} className="break-all text-sm text-gray-600">
                          {attendee.displayName || attendee.email}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abrir en Google
                <FiExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
