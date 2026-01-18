/**
 * Página de Agenda
 * Calendario y agenda de actividades, integrado con Google Calendar
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import {
  Calendar,
  dateFnsLocalizer,
  Event as RBCEvent,
  Views,
  SlotInfo,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import esES from "date-fns/locale/es";
import { FiPlus, FiLogOut, FiCheckCircle } from "react-icons/fi";
import CreateEventModal from "./components/CreateEventModal";
import DeleteEventModal from "./components/DeleteEventModal";
import {
  saveGoogleToken,
  getStoredGoogleToken,
  isGoogleTokenValid,
  clearGoogleToken,
} from "@/lib/googleCalendar";

// Tipos globales para Google Identity Services y gapi
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// Localización a español para el calendario
const locales = {
  es: esES,
  "es-MX": esES,
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
  useEffect(() => {
    console.log("CLIENT_ID frontend:", GOOGLE_CALENDAR_CLIENT_ID);
    console.log("API_KEY frontend:", GOOGLE_CALENDAR_API_KEY);
    if (typeof window !== "undefined") {
      console.log("ORIGIN frontend:", window.location.origin);
    }
  }, []);

  const router = useRouter();
  const { user, loading } = useUser();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Autenticación base del sistema
  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  // Intentar restaurar sesión de Google Calendar al cargar
  useEffect(() => {
    const restoreGoogleSession = async () => {
      if (!isGoogleTokenValid()) {
        return;
      }

      const storedToken = getStoredGoogleToken();
      if (!storedToken) {
        return;
      }

      try {
        // Inicializar cliente de Google
        const ok = await initGoogleClient();
        if (!ok) {
          return;
        }

        // Configurar el token guardado
        window.gapi.client.setToken({
          access_token: storedToken,
        });

        // Verificar que el token funciona intentando cargar eventos
        await loadGoogleEvents();
        setIsConnected(true);
      } catch (err: any) {
        console.error("Error al restaurar sesión de Google:", err);
        // Si el token no funciona, limpiarlo
        clearGoogleToken();
      }
    };

    restoreGoogleSession();
  }, []); // Solo ejecutar una vez al montar

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

  const loadGoogleEvents = useCallback(async () => {
    if (typeof window === "undefined" || !window.gapi?.client?.calendar) {
      return;
    }

    try {
      const now = new Date();
      const in30days = new Date();
      in30days.setDate(now.getDate() + 30);

      const response = await window.gapi.client.calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: in30days.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 50,
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
    }
  }, []);

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
    setIsDeleteModalOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !window.gapi?.client?.calendar) {
      throw new Error("No se puede eliminar el evento");
    }

    try {
      const response = await window.gapi.client.calendar.events.delete({
        calendarId: "primary",
        eventId: selectedEvent.id,
        sendUpdates: "all", // Enviar notificaciones a los asistentes
      });

      if (response.status === 200 || response.status === 204) {
        // Recargar eventos después de eliminar
        await loadGoogleEvents();
      } else {
        throw new Error("No se pudo eliminar el evento");
      }
    } catch (err: any) {
      console.error("Error al eliminar evento:", err);
      
      // Si el error es de autenticación, limpiar token
      if (err.status === 401 || err.code === 401) {
        clearGoogleToken();
        setIsConnected(false);
        throw new Error("Tu sesión expiró. Por favor, vuelve a conectar.");
      }
      
      throw new Error(err.message || "Error al eliminar el evento");
    }
  };

  const handleDisconnectGoogle = () => {
    clearGoogleToken();
    setIsConnected(false);
    setEvents([]);
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
              await loadGoogleEvents();
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Agenda</h1>
          <p className="text-sm text-gray-600">
            Visualiza tus próximas citas sincronizadas con Google Calendar.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {isConnected && (
              <>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                >
                  <FiPlus className="w-5 h-5" />
                  Nueva Reunión
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                  title="Desconectar Google Calendar"
                >
                  <FiLogOut className="w-5 h-5" />
                  Desconectar
                </button>
              </>
            )}
            {!isConnected && (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={loadingCalendar || !hasEnvConfig}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
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
            <p className="text-xs text-red-500 max-w-xs text-right">
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

      <div className="bg-white rounded-lg shadow p-4 h-[70vh]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          defaultView={Views.WEEK}
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
      />

      <DeleteEventModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedEvent(null);
        }}
        onConfirm={handleDeleteEvent}
        eventTitle={selectedEvent?.title || ""}
      />
    </div>
  );
}
