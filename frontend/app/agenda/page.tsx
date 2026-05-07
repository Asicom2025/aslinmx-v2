/**
 * Página de Agenda
 * Calendario y agenda de actividades, integrado con Google Calendar
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  Calendar,
  dateFnsLocalizer,
  Event as RBCEvent,
  Views,
  SlotInfo,
  View,
} from "react-big-calendar";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { FiPlus, FiLogOut, FiCheckCircle } from "react-icons/fi";
import { useTour } from "@/hooks/useTour";
import TourButton from "@/components/ui/TourButton";
import CreateEventModal from "./components/CreateEventModal";
import EventDetailModal from "./components/EventDetailModal";
import {
  saveGoogleToken,
  getStoredGoogleToken,
  isGoogleTokenValid,
  clearGoogleToken,
} from "@/lib/googleCalendar";

// Tipos globales para Google Identity Services y gapi (opcionales: se cargan en runtime)
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

// Localización a español para el calendario
const locales = {
  es,
  "es-MX": es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface CalendarEvent extends RBCEvent {
  id: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  meetLink?: string;
  creatorEmail?: string;
  organizerEmail?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  calendarId?: string;
  calendarName?: string;
}

interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

const GOOGLE_CALENDAR_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CALENDAR_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY;

const GOOGLE_CALENDAR_SCOPES =
  "https://www.googleapis.com/auth/calendar";
const GOOGLE_CALENDAR_DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
];

export default function AgendaPage() {
  useTour("tour-agenda", { autoStart: true });
  const router = useRouter();
  const { user, loading } = useUser();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | undefined>();
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("primary");
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);

  const visibleRange = useMemo(() => {
    if (calendarView === Views.MONTH) {
      return {
        start: startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 }),
      };
    }
    if (calendarView === Views.DAY) {
      return { start: startOfDay(calendarDate), end: endOfDay(calendarDate) };
    }
    if (calendarView === Views.AGENDA) {
      return { start: startOfDay(calendarDate), end: endOfDay(addDays(calendarDate, 30)) };
    }
    return {
      start: startOfWeek(calendarDate, { weekStartsOn: 1 }),
      end: endOfWeek(calendarDate, { weekStartsOn: 1 }),
    };
  }, [calendarDate, calendarView]);

  // Autenticación base del sistema
  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  const ensureGapiLoaded = useCallback((): Promise<void> => {
    if (typeof window === "undefined") return Promise.resolve();

    if (window.gapi?.client) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById("gapi-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", (err) => reject(err));
        return;
      }

      const script = document.createElement("script");
      script.id = "gapi-script";
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  }, []);

  const ensureGoogleIdentityLoaded = useCallback((): Promise<void> => {
    if (typeof window === "undefined") return Promise.resolve();

    if (window.google?.accounts) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById("google-identity-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", (err) => reject(err));
        return;
      }

      const script = document.createElement("script");
      script.id = "google-identity-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  }, []);

  const initGoogleClient = useCallback(async () => {
    if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_API_KEY) {
      setError(
        "Faltan variables de entorno: configura NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID y NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY."
      );
      return false;
    }

    await ensureGapiLoaded();
    await ensureGoogleIdentityLoaded();

    return new Promise<boolean>((resolve, reject) => {
      window.gapi.load("client", () => {
        window.gapi.client
          .init({
            apiKey: GOOGLE_CALENDAR_API_KEY,
            discoveryDocs: GOOGLE_CALENDAR_DISCOVERY_DOCS,
          })
          .then(
            () => {
              resolve(true);
            },
            (err: any) => {
              console.error("Error al inicializar Google API:", err);
              setError("No se pudo inicializar Google Calendar.");
              reject(err);
            }
          );
      });
    });
  }, []);

  const loadCalendars = useCallback(async () => {
    if (typeof window === "undefined" || !window.gapi?.client?.calendar) {
      return [];
    }

    try {
      const rawItems: any[] = [];
      let pageToken: string | undefined;

      do {
        const response = await window.gapi.client.calendar.calendarList.list({
          maxResults: 250,
          pageToken,
          showDeleted: false,
          showHidden: true,
        });
        rawItems.push(...(response.result.items || []));
        pageToken = response.result.nextPageToken;
      } while (pageToken);

      const items: GoogleCalendarListItem[] = rawItems.map(
        (item: any) => ({
          id: item.id,
          summary: item.summary || item.id,
          primary: !!item.primary,
          backgroundColor: item.backgroundColor,
          accessRole: item.accessRole,
        }),
      );
      setCalendars(items);

      setSelectedCalendarId((current) => {
        if (items.some((calendar) => calendar.id === current)) return current;
        return (items.find((calendar) => calendar.primary) || items[0])?.id || "primary";
      });
      return items;
    } catch (err: any) {
      console.error("Error al cargar calendarios de Google Calendar:", err);
      if (err.status === 401 || err.code === 401) {
        clearGoogleToken();
        setIsConnected(false);
        setError("Tu sesión de Google Calendar expiró. Por favor, vuelve a conectar.");
      } else {
        setError("No se pudieron cargar tus calendarios de Google Calendar.");
      }
      return [];
    }
  }, []);

  const loadGoogleEvents = useCallback(async () => {
    if (typeof window === "undefined" || !window.gapi?.client?.calendar) {
      return;
    }

    try {
      setLoadingEvents(true);
      setError(null);
      const activeCalendar = calendars.find((calendar) => calendar.id === selectedCalendarId);

      const response = await window.gapi.client.calendar.events.list({
        calendarId: selectedCalendarId,
        timeMin: visibleRange.start.toISOString(),
        timeMax: visibleRange.end.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 250,
        orderBy: "startTime",
      });

      const items = response.result.items || [];

      const mapped: CalendarEvent[] = items
        .map((item: any) => {
          const startStr = item.start?.dateTime || item.start?.date;
          const endStr = item.end?.dateTime || item.end?.date;
          if (!startStr || !endStr) return null;

          return {
            id: item.id,
            title: item.summary || "(Sin título)",
            start: new Date(startStr),
            end: new Date(endStr),
            allDay: !item.start?.dateTime,
            description: item.description,
            location: item.location,
            htmlLink: item.htmlLink,
            hangoutLink: item.hangoutLink,
            meetLink:
              item.hangoutLink ||
              item.conferenceData?.entryPoints?.find(
                (entry: any) => entry.entryPointType === "video",
              )?.uri,
            creatorEmail: item.creator?.email,
            organizerEmail: item.organizer?.email,
            attendees: item.attendees || [],
            calendarId: selectedCalendarId,
            calendarName: activeCalendar?.summary,
          } as CalendarEvent;
        })
        .filter((e: CalendarEvent | null): e is CalendarEvent => e !== null);

      setEvents(mapped);
    } catch (err: any) {
      console.error("Error al cargar eventos de Google Calendar:", err);
      
      // Si el error es de autenticación, limpiar token y desconectar
      if (err.status === 401 || err.code === 401) {
        clearGoogleToken();
        setIsConnected(false);
        setError("Tu sesión de Google Calendar expiró. Por favor, vuelve a conectar.");
      } else {
        setError("No se pudieron cargar los eventos de Google Calendar.");
      }
    } finally {
      setLoadingEvents(false);
    }
  }, [calendars, selectedCalendarId, visibleRange]);

  useEffect(() => {
    const restoreGoogleSession = async () => {
      if (!isGoogleTokenValid()) return;

      const storedToken = getStoredGoogleToken();
      if (!storedToken) return;

      try {
        const ok = await initGoogleClient();
        if (!ok) return;

        window.gapi.client.setToken({
          access_token: storedToken,
        });

        await loadCalendars();
        setIsConnected(true);
      } catch (err: any) {
        console.error("Error al restaurar sesión de Google:", err);
        clearGoogleToken();
      }
    };

    restoreGoogleSession();
  }, [initGoogleClient, loadCalendars]);

  useEffect(() => {
    if (!isConnected) return;
    loadGoogleEvents();
  }, [isConnected, loadGoogleEvents]);

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    if (!isConnected) {
      setError("Debes conectar con Google Calendar primero");
      return;
    }
    setSelectedSlot({
      start: slotInfo.start,
      end: slotInfo.end,
    });
    setIsCreateModalOpen(true);
  };

  const handleEventCreated = () => {
    // Recargar eventos después de crear uno nuevo
    loadGoogleEvents();
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleDisconnectGoogle = () => {
    clearGoogleToken();
    setIsConnected(false);
    setEvents([]);
    setCalendars([]);
    setSelectedCalendarId("primary");
    setError(null);
    
    // Limpiar token de gapi si está configurado
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
  };

  const handleConnectGoogle = async () => {
    setError(null);
    setLoadingCalendar(true);
    try {
      const ok = await initGoogleClient();
      if (!ok) {
        setLoadingCalendar(false);
        return;
      }

      // Usar Google Identity Services (GIS) en lugar de auth2
      await ensureGoogleIdentityLoaded();

      await new Promise<void>((resolve, reject) => {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CALENDAR_CLIENT_ID!,
            scope: GOOGLE_CALENDAR_SCOPES,
            callback: async (response: any) => {
              if (response.error) {
                console.error("Error de autenticación:", response.error);
                setError("No se pudo autenticar con Google Calendar.");
                setLoadingCalendar(false);
                // Limpiar token si hay error
                clearGoogleToken();
                reject(response.error);
                return;
              }

              // Guardar el token para persistencia
              saveGoogleToken(
                response.access_token,
                response.expires_in // Tiempo de expiración en segundos
              );

              // Configurar el token de acceso en gapi
              window.gapi.client.setToken({
                access_token: response.access_token,
              });

              setIsConnected(true);
              await loadCalendars();
              setLoadingCalendar(false);
              resolve();
            },
          });
          tokenClient.requestAccessToken();
        } catch (err: any) {
          console.error("Error al crear token client:", err);
          setError("No se pudo inicializar el cliente de autenticación.");
          setLoadingCalendar(false);
          reject(err);
        }
      });
    } catch (err: any) {
      console.error("Error al conectar con Google Calendar:", err);
      setError("No se pudo conectar con Google Calendar.");
      setLoadingCalendar(false);
    }
  };

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    const summary = newCalendarName.trim();
    if (!summary) {
      setError("Escribe el nombre del calendario.");
      return;
    }
    if (!window.gapi?.client?.calendar) {
      setError("Google Calendar API no está inicializada.");
      return;
    }

    setCreatingCalendar(true);
    setError(null);
    try {
      const response = await window.gapi.client.calendar.calendars.insert({
        resource: {
          summary,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      const createdId = response.result?.id;
      await loadCalendars();
      if (createdId) setSelectedCalendarId(createdId);
      setNewCalendarName("");
      setIsCreateCalendarOpen(false);
    } catch (err: any) {
      console.error("Error al crear calendario:", err);
      if (err.status === 401 || err.code === 401) {
        clearGoogleToken();
        setIsConnected(false);
        setError("Tu sesión de Google Calendar expiró. Por favor, vuelve a conectar.");
      } else {
        setError(err.message || "No se pudo crear el calendario.");
      }
    } finally {
      setCreatingCalendar(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const hasEnvConfig = !!GOOGLE_CALENDAR_CLIENT_ID && !!GOOGLE_CALENDAR_API_KEY;

  return (
    <div className="container-app w-full space-y-4 py-4 sm:space-y-5 sm:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">Agenda</h1>
            {isConnected && (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <select
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  className="min-h-10 max-w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:max-w-xs"
                  aria-label="Seleccionar calendario"
                >
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary}
                      {calendar.primary ? " (Principal)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreateCalendarOpen(true)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiPlus className="h-4 w-4" />
                  Crear Calendario
                </button>
              </div>
            )}
          </div>
          <div className="mt-1">
            <TourButton tour="tour-agenda" label="Ver guía" />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Visualiza tus próximas citas sincronizadas con Google Calendar.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:items-end">
          <div className="flex flex-wrap gap-2">
            {isConnected && (
              <>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 sm:flex-initial sm:px-4 touch-manipulation"
                >
                  <FiPlus className="w-5 h-5" />
                  Nueva Reunión
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 sm:flex-initial sm:px-4 touch-manipulation"
                  title="Desconectar Google Calendar"
                >
                  <FiLogOut className="w-5 h-5" />
                  Desconectar
                </button>
              </>
            )}
            {!isConnected && (
              <button
                data-tour="agenda-conectar"
                type="button"
                onClick={handleConnectGoogle}
                disabled={loadingCalendar || !hasEnvConfig}
                className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium sm:w-auto sm:px-4 touch-manipulation ${
                  hasEnvConfig
                    ? "bg-primary-600 text-white hover:bg-primary-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                {loadingCalendar ? "Conectando..." : "Conectar con Google Calendar"}
              </button>
            )}
          </div>
          {!hasEnvConfig && (
            <p className="max-w-full break-words text-xs text-red-500 lg:max-w-xs lg:text-right">
              Configura las variables{" "}
              <code className="bg-red-50 px-1 rounded">
                NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID
              </code>{" "}
              y{" "}
              <code className="bg-red-50 px-1 rounded">
                NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY
              </code>{" "}
              en tu archivo <code>.env</code>.
            </p>
          )}
          {isConnected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 flex items-center gap-1">
                <FiCheckCircle className="w-3 h-3" />
                Conectado a Google Calendar
              </span>
              {loadingEvents && (
                <span className="text-xs text-gray-500">Actualizando eventos...</span>
              )}
              {isGoogleTokenValid() && (
                <span className="text-xs text-gray-500">
                  (Sesión guardada)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      <div
        data-tour="agenda-calendario"
        className="h-[calc(100dvh-18rem)] min-h-[34rem] overflow-x-auto rounded-lg bg-white p-2 shadow sm:p-4"
      >
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          date={calendarDate}
          view={calendarView}
          onNavigate={(date) => setCalendarDate(date)}
          onView={(view) => setCalendarView(view)}
          step={30}
          timeslots={2}
          style={{ height: "100%" }}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          messages={{
            today: "Hoy",
            previous: "Anterior",
            next: "Siguiente",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            noEventsInRange: "No hay eventos en este rango",
            showMore: (total) => `+ Ver ${total} más`,
          }}
        />
      </div>

      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedSlot(undefined);
        }}
        onSuccess={handleEventCreated}
        selectedSlot={selectedSlot}
        calendarId={selectedCalendarId}
      />

      <EventDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />

      {isCreateCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Crear Calendario</h2>
              <p className="mt-1 text-sm text-gray-500">
                Se agregará a la misma cuenta de Google Calendar conectada.
              </p>
            </div>
            <form onSubmit={handleCreateCalendar} className="space-y-4">
              <div>
                <label
                  htmlFor="calendarName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Nombre del calendario
                </label>
                <input
                  id="calendarName"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Reuniones comerciales"
                  disabled={creatingCalendar}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateCalendarOpen(false);
                    setNewCalendarName("");
                  }}
                  disabled={creatingCalendar}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={creatingCalendar}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {creatingCalendar ? "Creando..." : "Crear calendario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
