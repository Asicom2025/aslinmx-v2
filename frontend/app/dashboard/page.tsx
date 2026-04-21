/**
 * Dashboard Principal
 * Muestra métricas importantes y estadísticas del sistema con Highcharts
 */

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { usePermisos } from "@/hooks/usePermisos";
import apiService from "@/lib/apiService";
import { getRecentVisitedSiniestros } from "@/lib/recentSiniestrosStorage";
import { getUserDisplayName } from "@/lib/userName";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiBarChart2, FiTrendingUp, FiUsers, FiFileText, FiBell, FiMap } from "react-icons/fi";
import { useTour } from "@/hooks/useTour";
import TourButton from "@/components/ui/TourButton";
import { FaFileContract } from "react-icons/fa";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

let highchartsModulesLoaded = false;

// Variable para rastrear si el módulo de mapas está cargado (persiste entre montajes)
let mapModuleLoaded = false;

// Caché del mapa de México para evitar recargas (es estático)
let mexicoMapCache: any = null;

const HIGHCHARTS_MENU_ITEMS = [
  "viewFullscreen",
  "separator",
  "printChart",
  "separator",
  "downloadPNG",
  "downloadJPEG",
  "downloadPDF",
  "downloadSVG",
  "separator",
  "downloadCSV",
  "downloadXLS",
  "viewData",
] as const;

type DashboardSiniestrosFilters = {
  estado_id?: string;
  area_id?: string;
  prioridad?: string;
  asegurado_estado?: string;
  fecha_registro_mes?: string;
};

interface DashboardStats {
  total_siniestros: number;
  siniestros_activos: number;
  siniestros_criticos: number;
  notificaciones_no_leidas: number;
  actividades_recientes: number;
  siniestros_por_estado: Array<{ nombre: string; cantidad: number }>;
  siniestros_por_prioridad: Array<{ prioridad: string; cantidad: number }>;
  siniestros_por_area: Array<{ nombre: string; cantidad: number }>;
}

interface RecentSiniestro {
  id: string;
  numero_siniestro: string;
  fecha_registro?: string | null;
  fecha_siniestro?: string | null;
  prioridad: string;
  estado_id?: string;
  area_principal_id?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { can } = usePermisos();
  useTour("tour-dashboard", { autoStart: true });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSiniestros, setRecentSiniestros] = useState<RecentSiniestro[]>([]);
  const [recentSiniestrosFromCache, setRecentSiniestrosFromCache] = useState(false);
  const [siniestrosByMonth, setSiniestrosByMonth] = useState<Array<{ mes: string; cantidad: number }>>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  const [highchartsModulesReady, setHighchartsModulesReady] = useState(highchartsModulesLoaded);
  const [mexicoMapData, setMexicoMapData] = useState<any>(() => mexicoMapCache);
  const [mapModuleReady, setMapModuleReady] = useState(mapModuleLoaded);
  const [mapLoadError, setMapLoadError] = useState(false);
  const isMountedRef = useRef(true);

  // Cargar módulo de mapas y datos del mapa de México en paralelo al montar (sin depender del usuario)
  useEffect(() => {
    if (typeof window === "undefined") return;
    isMountedRef.current = true;

    if (highchartsModulesLoaded) {
      setHighchartsModulesReady(true);
    } else {
      Promise.all([
        import("highcharts/modules/exporting"),
        import("highcharts/modules/export-data"),
        import("highcharts/modules/accessibility"),
      ])
        .then((modules) => {
          modules.forEach((loadedModule) => {
            const moduleFn = loadedModule.default || loadedModule;
            if (typeof moduleFn === "function") {
              (moduleFn as (h: typeof Highcharts) => void)(Highcharts);
            }
          });
          highchartsModulesLoaded = true;
          if (isMountedRef.current) setHighchartsModulesReady(true);
        })
        .catch((error) => {
          console.error("Error al cargar módulos base de Highcharts:", error);
          highchartsModulesLoaded = true;
          if (isMountedRef.current) setHighchartsModulesReady(true);
        });
    }

    // Si el módulo ya fue cargado (remount por Strict Mode), marcar como listo
    if (mapModuleLoaded) {
      setMapModuleReady(true);
    } else {
      import("highcharts/modules/map")
        .then((HighchartsMapModule) => {
          const mapModule = HighchartsMapModule.default || HighchartsMapModule;
          if (typeof mapModule === "function") {
            (mapModule as (h: typeof Highcharts) => void)(Highcharts);
          }
          mapModuleLoaded = true;
          if (isMountedRef.current) setMapModuleReady(true);
        })
        .catch((error) => {
          console.error("Error al cargar el módulo de mapas de Highcharts:", error);
          if (isMountedRef.current) setMapLoadError(true);
        });
    }

    // Cargar mapa de México: usar caché si existe, si no fetch
    if (mexicoMapCache) {
      if (isMountedRef.current) setMexicoMapData(mexicoMapCache);
    } else {
      fetch("/mx-all.topo.json")
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then((mapData) => {
          mexicoMapCache = mapData;
          if (isMountedRef.current) setMexicoMapData(mapData);
        })
        .catch((error) => {
          console.error("Error al cargar el mapa de México:", error);
          if (isMountedRef.current) setMapLoadError(true);
        });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
    loadDashboardData();
  }, [user, loading, router]);

  // Mapeo de nombres de estados mexicanos a códigos ISO o nombres del mapa
  // Este mapeo ayuda a relacionar los nombres de estados con los códigos del mapa
  const estadoMap: Record<string, string> = {
    "Aguascalientes": "mx-ag",
    "Baja California": "mx-bc",
    "Baja California Sur": "mx-bs",
    "Campeche": "mx-cm",
    "Chiapas": "mx-cp",
    "Chihuahua": "mx-ch",
    "Ciudad de México": "mx-df",
    "Coahuila": "mx-co",
    "Colima": "mx-cl",
    "Durango": "mx-dg",
    "Estado de México": "mx-mx",
    "Guanajuato": "mx-gj",
    "Guerrero": "mx-gr",
    "Hidalgo": "mx-hg",
    "Jalisco": "mx-ja",
    "Michoacán": "mx-mi",
    "Morelos": "mx-mo",
    "Nayarit": "mx-na",
    "Nuevo León": "mx-nl",
    "Oaxaca": "mx-oa",
    "Puebla": "mx-pu",
    "Querétaro": "mx-qe",
    "Quintana Roo": "mx-qr",
    "San Luis Potosí": "mx-sl",
    "Sinaloa": "mx-si",
    "Sonora": "mx-so",
    "Tabasco": "mx-tb",
    "Tamaulipas": "mx-tm",
    "Tlaxcala": "mx-tl",
    "Veracruz": "mx-ve",
    "Yucatán": "mx-yu",
    "Zacatecas": "mx-za",
  };

  const loadDashboardData = async () => {
    try {
      setLoadingStats(true);
      const canRecent = can("dashboard", "ver_siniestros_recientes");
      const canMes = can("dashboard", "ver_grafica_por_mes");

      // Siniestros recientes: priorizar los últimos visitados por el usuario (localStorage)
      const visited = getRecentVisitedSiniestros();
      const recentFallback = canRecent ? apiService.getRecentSiniestros(5) : Promise.resolve([]);

      const [statsData, recentData, monthlyData, areasData, estadosData] = await Promise.all([
        apiService.getDashboardStats(),
        recentFallback,
        canMes ? apiService.getSiniestrosByMonth(6) : Promise.resolve([]),
        apiService.getAreas(true),
        apiService.getEstadosSiniestro(true),
      ]);
      setStats(statsData);
      // Usar visitados recientes si hay; si no, usar los del API (recientes por fecha de registro)
      if (canRecent) {
        const fromCache = visited.length > 0;
        const list = fromCache ? visited.slice(0, 5) : (Array.isArray(recentData) ? recentData : []);
        setRecentSiniestros(list);
        setRecentSiniestrosFromCache(fromCache);
      } else {
        setRecentSiniestros([]);
        setRecentSiniestrosFromCache(false);
      }
      setSiniestrosByMonth(Array.isArray(monthlyData) ? monthlyData : []);
      setAreas(areasData);
      setEstados(estadosData);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Error al cargar datos del dashboard:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const prioridadColors: Record<string, string> = {
    baja: "bg-green-100 text-green-800",
    media: "bg-yellow-100 text-yellow-800",
    alta: "bg-orange-100 text-orange-800",
    critica: "bg-red-100 text-red-800",
  };

  const getAreaNombre = (areaId?: string) => {
    if (!areaId) return "Sin área";
    const area = areas.find((a) => a.id === areaId);
    return area?.nombre || "N/A";
  };

  const getEstadoNombre = (estadoId?: string) => {
    if (!estadoId) return "Sin estado";
    const estado = estados.find((e) => e.id === estadoId);
    return estado?.nombre || "N/A";
  };

  const highchartsExportingOptions: Highcharts.Options["exporting"] = {
    enabled: true,
    buttons: {
      contextButton: {
        menuItems: [...HIGHCHARTS_MENU_ITEMS],
      },
    },
  };

  const getCommonAccessibility = (
    chartDescription: string
  ): Highcharts.Options["accessibility"] => ({
    enabled: true,
    description: `${chartDescription}. Haz clic en un elemento para abrir la lista de siniestros filtrada.`,
    keyboardNavigation: {
      enabled: true,
    },
  });

  const openDashboardSiniestros = (filters: DashboardSiniestrosFilters) => {
    const params = new URLSearchParams();
    params.set("activo", "all");

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    router.push(`/siniestros?${params.toString()}`);
  };

  const getAreaIdByName = (areaNombre: string) => {
    const area = areas.find((item) => item.nombre === areaNombre);
    return area?.id;
  };

  // Configuración del gráfico de barras para Estados
  const estadosChartOptions: Highcharts.Options = {
    chart: {
      type: "column",
      height: 300,
    },
    accessibility: {
      ...getCommonAccessibility("Distribución de siniestros por estado geográfico"),
    },
    title: {
      text: undefined,
    },
    exporting: highchartsExportingOptions,
    xAxis: {
      categories: stats?.siniestros_por_estado.map((item) => item.nombre) || [],
      title: {
        text: "Estados",
      },
    },
    yAxis: {
      title: {
        text: "Cantidad",
      },
    },
    series: [
      {
        name: "Siniestros",
        type: "column",
        data:
          stats?.siniestros_por_estado.map((item) => ({
            name: item.nombre,
            y: item.cantidad,
            events: {
              click: () =>
                openDashboardSiniestros({
                  asegurado_estado: item.nombre,
                }),
            },
          })) || [],
        color: "#0A2E5C",
      },
    ],
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    plotOptions: {
      column: {
        cursor: "pointer",
        borderRadius: 4,
        dataLabels: {
          enabled: true,
        },
      },
    },
  };

  // Configuración del gráfico de barras para Prioridades
  const prioridadesChartOptions: Highcharts.Options = {
    chart: {
      type: "bar",
      height: 300,
    },
    accessibility: {
      ...getCommonAccessibility("Distribución de siniestros por prioridad"),
    },
    title: {
      text: undefined,
    },
    exporting: highchartsExportingOptions,
    xAxis: {
      categories: stats?.siniestros_por_prioridad.map((item) => item.prioridad.toUpperCase()) || [],
      title: {
        text: "Prioridades",
      },
    },
    yAxis: {
      title: {
        text: "Cantidad",
      },
    },
    series: [
      {
        name: "Siniestros",
        type: "bar",
        data:
          stats?.siniestros_por_prioridad.map((item) => ({
            name: item.prioridad.toUpperCase(),
            y: item.cantidad,
            color:
              item.prioridad === "critica"
                ? "#DC2626"
                : item.prioridad === "alta"
                ? "#EA580C"
                : item.prioridad === "media"
                ? "#EAB308"
                : "#22C55E",
            events: {
              click: () =>
                openDashboardSiniestros({
                  prioridad: item.prioridad,
                }),
            },
          })) || [],
      },
    ],
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    plotOptions: {
      bar: {
        cursor: "pointer",
        borderRadius: 4,
        dataLabels: {
          enabled: true,
        },
      },
    },
  };

  // Configuración del gráfico de dona para Áreas
  const areasChartOptions: Highcharts.Options = {
    chart: {
      type: "pie",
      height: 300,
    },
    accessibility: {
      ...getCommonAccessibility("Distribución de siniestros por área"),
    },
    title: {
      text: undefined,
    },
    exporting: highchartsExportingOptions,
    tooltip: {
      pointFormat: "{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)",
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: "pointer",
        dataLabels: {
          enabled: true,
          format: "<b>{point.name}</b>: {point.y}",
        },
        innerSize: "50%",
      },
    },
    series: [
      {
        name: "Siniestros",
        type: "pie",
        data:
          stats?.siniestros_por_area.map((item) => ({
            name: item.nombre,
            y: item.cantidad,
            events: {
              click: () => {
                const areaId = getAreaIdByName(item.nombre);
                if (!areaId) return;
                openDashboardSiniestros({
                  area_id: areaId,
                });
              },
            },
          })) || [],
      },
    ],
    credits: {
      enabled: false,
    },
  };

  // Configuración del gráfico de líneas para Siniestros por Mes
  const mesesChartOptions: Highcharts.Options = {
    chart: {
      type: "line",
      height: 300,
    },
    accessibility: {
      ...getCommonAccessibility("Evolución mensual de siniestros"),
    },
    title: {
      text: undefined,
    },
    exporting: highchartsExportingOptions,
    xAxis: {
      categories: siniestrosByMonth.map((item) => item.mes) || [],
      title: {
        text: "Mes",
      },
    },
    yAxis: {
      title: {
        text: "Cantidad",
      },
    },
    series: [
      {
        name: "Siniestros",
        type: "line",
        data:
          siniestrosByMonth.map((item) => ({
            name: item.mes,
            y: item.cantidad,
            events: {
              click: () =>
                openDashboardSiniestros({
                  fecha_registro_mes: item.mes,
                }),
            },
          })) || [],
        color: "#0A2E5C",
        marker: {
          radius: 6,
        },
      },
    ],
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    plotOptions: {
      line: {
        cursor: "pointer",
        dataLabels: {
          enabled: true,
        },
      },
    },
  };

  // Configuración del mapa de México con siniestros por estado
  const mexicoMapChartOptions = useMemo((): Highcharts.Options => {
    const siniestrosPorEstado = stats?.siniestros_por_estado ?? [];
    if (!mexicoMapData) {
      return {
        chart: { type: "map", height: 500 },
        accessibility: { enabled: false },
        title: { text: undefined },
      };
    }

    // Crear un mapa de códigos del mapa -> cantidad de siniestros
    const codigoMapaToCantidad = new Map<string, number>();
    siniestrosPorEstado.forEach((item) => {
      // Filtrar estados inválidos
      if (!item.nombre || item.nombre === "Sin estado") {
        return;
      }
      
      // Convertir el nombre canónico del estado al código del mapa usando estadoMap
      const codigoMapa = estadoMap[item.nombre];
      if (codigoMapa) {
        // Si ya existe, sumar; si no, establecer
        const cantidadActual = codigoMapaToCantidad.get(codigoMapa) || 0;
        codigoMapaToCantidad.set(codigoMapa, cantidadActual + item.cantidad);
      } else {
        console.warn(`No se encontró código de mapa para el estado: ${item.nombre}`);
      }
    });

    console.log("Estados con siniestros:", Array.from(codigoMapaToCantidad.entries()));

    // Los TopoJSON de Highcharts pueden tener diferentes estructuras
    // Intentar extraer features de diferentes formas
    let mapFeatures: any[] = [];
    
    if ((mexicoMapData as any).features) {
      // Formato GeoJSON con features
      mapFeatures = (mexicoMapData as any).features;
    } else if ((mexicoMapData as any).objects) {
      // Formato TopoJSON con objects - Highcharts lo maneja internamente
      // En este caso, necesitamos crear los datos basados en los códigos conocidos
      console.log("TopoJSON con objects, creando datos basados en códigos conocidos");
      
      // Crear datos directamente usando los códigos del estadoMap
      const mapData = Object.keys(estadoMap).map((nombreEstado) => {
        const codigoMapa = estadoMap[nombreEstado];
        const cantidad = codigoMapaToCantidad.get(codigoMapa) || 0;
        return {
          "hc-key": codigoMapa,
          name: nombreEstado,
          value: cantidad,
          events: {
            click: () => {
              if (!cantidad) return;
              openDashboardSiniestros({
                asegurado_estado: nombreEstado,
              });
            },
          },
        };
      });
      
      console.log("Datos del mapa creados:", mapData.slice(0, 5));
      console.log("Total de estados en datos:", mapData.length);
      
      // Calcular el máximo valor para el colorAxis
      const valores = mapData.map((d: any) => d.value);
      const maxValor = Math.max(...valores, 1);
      console.log("Valor máximo de siniestros:", maxValor);

      return {
        chart: {
          type: "map",
          map: mexicoMapData,
          height: 500,
        },
        accessibility: {
          ...getCommonAccessibility("Mapa de siniestros por estado geográfico en México"),
        },
        title: {
          text: undefined,
        },
        exporting: highchartsExportingOptions,
        mapNavigation: {
          enabled: true,
          buttonOptions: {
            verticalAlign: "bottom",
          },
        },
        colorAxis: {
          min: 0,
          max: maxValor,
          minColor: "#E0F2FE",
          maxColor: "#0C4A6E",
          stops: [
            [0, "#E0F2FE"],
            [0.25, "#7DD3FC"],
            [0.5, "#0EA5E9"],
            [0.75, "#0284C7"],
            [1, "#0C4A6E"],
          ],
        },
        legend: {
          layout: "vertical",
          align: "right",
          verticalAlign: "middle",
          title: {
            text: "Siniestros",
          },
        },
        tooltip: {
          formatter: function () {
            const ctx = this as { point?: { name?: string; value?: number }; key?: string };
            const point = ctx.point;
            return `<b>${point?.name || ctx.key}</b><br/>Siniestros: <b>${point?.value ?? 0}</b>`;
          },
        },
        series: [
          {
            name: "Siniestros",
            type: "map",
            cursor: "pointer",
            states: {
              hover: {
                brightness: 0.2,
              },
            },
            dataLabels: {
              enabled: true,
              format: "{point.name}<br/>{point.value}",
              style: {
                fontWeight: "bold",
                fontSize: "9px",
                textOutline: "1px contrast",
                color: "#1F2937",
              },
            },
            data: mapData,
          },
        ],
        credits: {
          enabled: false,
        },
      };
    }

    // Si tiene features, procesarlos normalmente
    const mapData = mapFeatures.map((feature: any) => {
      const properties = feature.properties || {};
      // El TopoJSON de Highcharts usa "hc-key" como identificador principal
      const codigoMapa = properties["hc-key"] || properties.HASC_1 || properties.ISO || "";
      const nombreCanonico =
        Object.entries(estadoMap).find(([, codigo]) => codigo === codigoMapa)?.[0] || "";
      const nombreEstado =
        nombreCanonico ||
        properties.name ||
        properties.NAME ||
        properties.NAME_1 ||
        properties.admin ||
        codigoMapa;
      
      // Buscar la cantidad de siniestros usando el código del mapa
      const cantidad = codigoMapaToCantidad.get(codigoMapa) || 0;

      return {
        "hc-key": codigoMapa,
        name: nombreEstado,
        value: cantidad,
        events: {
          click: () => {
            if (!cantidad) return;
            openDashboardSiniestros({
              asegurado_estado: nombreEstado,
            });
          },
        },
      };
    });

    console.log("Datos del mapa (primeros 5):", mapData.slice(0, 5));
    console.log("Total de features en el mapa:", mapFeatures.length);

    // Calcular el máximo valor para el colorAxis
    const valores = mapData.map((d: any) => d.value);
    const maxValor = Math.max(...valores, 1); // Mínimo 1 para evitar división por cero

    console.log("Valor máximo de siniestros:", maxValor);

    // Mostrar todos los estados, incluso si no tienen siniestros (aparecerán en color claro)
    const dataToShow = mapData;

    return {
      chart: {
        type: "map",
        map: mexicoMapData,
        height: 500,
      },
      accessibility: {
        ...getCommonAccessibility("Mapa de siniestros por estado geográfico en México"),
      },
      title: {
        text: undefined,
      },
      exporting: highchartsExportingOptions,
      mapNavigation: {
        enabled: true,
        buttonOptions: {
          verticalAlign: "bottom",
        },
      },
      colorAxis: {
        min: 0,
        max: maxValor,
        minColor: "#E0F2FE", // Azul muy claro
        maxColor: "#0C4A6E", // Azul oscuro
        stops: [
          [0, "#E0F2FE"],
          [0.25, "#7DD3FC"],
          [0.5, "#0EA5E9"],
          [0.75, "#0284C7"],
          [1, "#0C4A6E"],
        ],
      },
      legend: {
        layout: "vertical",
        align: "right",
        verticalAlign: "middle",
        title: {
          text: "Siniestros",
        },
      },
      tooltip: {
        formatter: function () {
          const ctx = this as { point?: { name?: string; value?: number }; key?: string };
          const point = ctx.point;
          return `<b>${point?.name || ctx.key}</b><br/>Siniestros: <b>${point?.value ?? 0}</b>`;
        },
      },
      series: [
        {
          name: "Siniestros",
          type: "map",
          cursor: "pointer",
          states: {
            hover: {
              brightness: 0.2,
            },
          },
          dataLabels: {
            enabled: true,
            format: "{point.name}<br/>{point.value}",
            style: {
              fontWeight: "bold",
              fontSize: "9px",
              textOutline: "1px contrast",
              color: "#1F2937",
            },
          },
          data: dataToShow.length > 0 ? dataToShow : mapData,
        },
      ],
      credits: {
        enabled: false,
      },
    };
  }, [mexicoMapData, stats?.siniestros_por_estado, estadoMap]);

  if (loading || loadingStats || !user || !highchartsModulesReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No se pudieron cargar las estadísticas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app w-full space-y-4 py-4 sm:space-y-6 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600 break-words">
            Bienvenido, {getUserDisplayName(user, user?.email || "")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <TourButton tour="tour-dashboard" label="Ver guía" />
          <button
            data-tour="dashboard-actualizar"
            type="button"
            onClick={loadDashboardData}
            className="min-h-10 w-full touch-manipulation rounded-md bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 sm:w-auto"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Métricas principales (KPIs) */}
      {can("dashboard", "ver_kpis") && (
        <div data-tour="dashboard-metricas" className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <MetricCard
            title="Total Siniestros"
            value={stats.total_siniestros}
            icon={<FaFileContract className="w-6 h-6" />}
            color="bg-blue-500"
          />
          <MetricCard
            title="Siniestros Activos"
            value={stats.siniestros_activos}
            icon={<FiCheckCircle className="w-6 h-6" />}
            color="bg-green-500"
          />
          <MetricCard
            title="Siniestros Críticos"
            value={stats.siniestros_criticos}
            icon={<FiAlertTriangle className="w-6 h-6" />}
            color="bg-red-500"
          />
          <MetricCard
            title="Notificaciones"
            value={stats.notificaciones_no_leidas}
            icon={<FiBell className="w-6 h-6" />}
            color="bg-yellow-500"
          />
        </div>
      )}

      {/* Mapa de México - Siniestros por Estado */}
      {can("dashboard", "ver_grafica_mapa") && (
      <div data-tour="dashboard-mapa" className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiMap className="w-5 h-5" />
          Siniestros por Estado en México
        </h3>
        {mapLoadError ? (
          <p className="text-amber-600 text-sm py-8 text-center">
            No se pudo cargar el mapa. Intenta recargar la página.
          </p>
        ) : mapModuleReady && mexicoMapData ? (
          <HighchartsReact
            highcharts={Highcharts}
            constructorType={"mapChart"}
            options={mexicoMapChartOptions}
          />
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">Cargando mapa de México...</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros por Estado - Gráfico de Barras */}
        {can("dashboard", "ver_grafica_barras_por_estado") && (
        <div data-tour="dashboard-grafica-estados" className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiBarChart2 className="w-5 h-5" />
            Siniestros por Estado (Gráfico de Barras)
          </h3>
          {stats.siniestros_por_estado.length > 0 ? (
            <HighchartsReact highcharts={Highcharts} options={estadosChartOptions} />
          ) : (
            <p className="text-gray-500 text-sm">No hay datos disponibles</p>
          )}
        </div>
        )}

        {/* Siniestros por Prioridad - Gráfico de Barras Horizontal */}
        {can("dashboard", "ver_grafica_prioridad") && (
        <div data-tour="dashboard-grafica-prioridades" className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiTrendingUp className="w-5 h-5" />
            Siniestros por Prioridad
          </h3>
          {stats.siniestros_por_prioridad.length > 0 ? (
            <HighchartsReact highcharts={Highcharts} options={prioridadesChartOptions} />
          ) : (
            <p className="text-gray-500 text-sm">No hay datos disponibles</p>
          )}
        </div>
        )}
      </div>

      {/* Gráficos secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros por Área - Gráfico de Dona */}
        {can("dashboard", "ver_grafica_areas") && (
        <div className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiUsers className="w-5 h-5" />
            Siniestros por Área
          </h3>
          {stats.siniestros_por_area.length > 0 ? (
            <HighchartsReact highcharts={Highcharts} options={areasChartOptions} />
          ) : (
            <p className="text-gray-500 text-sm">No hay datos disponibles</p>
          )}
        </div>
        )}

        {/* Siniestros por Mes - Gráfico de Líneas */}
        {can("dashboard", "ver_grafica_por_mes") && (
        <div className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiTrendingUp className="w-5 h-5" />
            Siniestros por Mes (últimos 6 meses)
          </h3>
          {siniestrosByMonth.length > 0 ? (
            <HighchartsReact highcharts={Highcharts} options={mesesChartOptions} />
          ) : (
            <p className="text-gray-500 text-sm">No hay datos disponibles</p>
          )}
        </div>
        )}
      </div>

      {/* Siniestros Recientes y Actividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros Recientes */}
        {can("dashboard", "ver_siniestros_recientes") && (
        <div data-tour="dashboard-recientes" className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <FiClock className="w-5 h-5" />
            Siniestros Recientes
          </h3>
          <div className="mb-4">
            {recentSiniestrosFromCache && (
              <p className="text-sm text-gray-500 mt-1">Tus últimos visitados</p>
            )}
          </div>
          {recentSiniestros.length > 0 ? (
            <div className="space-y-3">
              {recentSiniestros.map((siniestro) => (
                <div
                  key={siniestro.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/siniestros/${siniestro.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{siniestro.numero_siniestro || "Sin número"}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        prioridadColors[siniestro.prioridad] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {siniestro.prioridad.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Estado: {getEstadoNombre(siniestro.estado_id)}</div>
                    <div>Área: {getAreaNombre(siniestro.area_principal_id)}</div>
                    {(siniestro.fecha_registro || siniestro.fecha_siniestro) && (
                      <div>
                        Fecha:{" "}
                        {new Date(
                          siniestro.fecha_registro || siniestro.fecha_siniestro || "",
                        ).toLocaleDateString("es-MX")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              {recentSiniestrosFromCache ? "Visita un siniestro para verlo aquí." : "No hay siniestros recientes."}
            </p>
          )}
        </div>
        )}

        {/* Actividades Recientes */}
        {can("dashboard", "ver_actividad_reciente") && (
        <div className="bg-white overflow-x-auto rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiFileText className="w-5 h-5" />
            Actividades Recientes (últimas 24 horas)
          </h3>
          <div className="text-center py-8">
            <p className="text-3xl font-bold text-primary-600">{stats.actividades_recientes}</p>
            <p className="text-sm text-gray-600 mt-2">Actividades registradas en bitácora</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{value}</p>
        </div>
        <div className={`shrink-0 rounded-lg p-3 text-white sm:p-4 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}
