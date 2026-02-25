/**
 * Dashboard Principal
 * Muestra métricas importantes y estadísticas del sistema con Highcharts
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiBarChart2, FiTrendingUp, FiUsers, FiFileText, FiBell, FiMap } from "react-icons/fi";
import { FaFileContract } from "react-icons/fa";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

// Variable para rastrear si el módulo de mapas está cargado
let mapModuleLoaded = false;

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
  fecha_siniestro: string;
  prioridad: string;
  estado_id?: string;
  area_principal_id?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSiniestros, setRecentSiniestros] = useState<RecentSiniestro[]>([]);
  const [siniestrosByMonth, setSiniestrosByMonth] = useState<Array<{ mes: string; cantidad: number }>>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  const [mexicoMapData, setMexicoMapData] = useState<any>(null);
  const [mapModuleReady, setMapModuleReady] = useState(false);

  // Inicializar módulo de mapas
  useEffect(() => {
    if (typeof window !== "undefined" && !mapModuleLoaded) {
      import("highcharts/modules/map")
        .then((HighchartsMapModule) => {
          // El módulo puede exportarse de diferentes formas
          const mapModule = HighchartsMapModule.default || HighchartsMapModule;
          if (typeof mapModule === "function") {
            mapModule(Highcharts);
          }
          mapModuleLoaded = true;
          setMapModuleReady(true);
        })
        .catch((error) => {
          console.error("Error al cargar el módulo de mapas de Highcharts:", error);
        });
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
    loadDashboardData();
    loadMexicoMap();
  }, [user, loading, router]);

  // Función para cargar el mapa de México desde el repositorio de Highcharts Maps
  const loadMexicoMap = async () => {
    try {
      // Cargar el mapa de México desde el repositorio oficial de Highcharts Maps
      const response = await fetch(
        "https://code.highcharts.com/mapdata/countries/mx/mx-all.topo.json"
      );
      if (response.ok) {
        const mapData = await response.json();
        console.log("Mapa cargado, estructura:", {
          tieneFeatures: !!mapData.features,
          tieneObjects: !!mapData.objects,
          keys: Object.keys(mapData),
          tipo: mapData.type,
        });
        setMexicoMapData(mapData);
      } else {
        console.error("Error al cargar el mapa de México:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error al cargar el mapa de México:", error);
    }
  };

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
      const [statsData, recentData, monthlyData, areasData, estadosData] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getRecentSiniestros(5),
        apiService.getSiniestrosByMonth(6),
        apiService.getAreas(true),
        apiService.getEstadosSiniestro(true),
      ]);
      setStats(statsData);
      setRecentSiniestros(recentData);
      setSiniestrosByMonth(monthlyData);
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

  // Función para normalizar nombres de estados (quitar acentos, convertir a minúsculas)
  const normalizeEstado = (nombre: string): string => {
    return nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-");
  };

  // Configuración del gráfico de barras para Estados
  const estadosChartOptions: Highcharts.Options = {
    chart: {
      type: "column",
      height: 300,
    },
    accessibility: {
      enabled: false,
    },
    title: {
      text: undefined,
    },
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
        data: stats?.siniestros_por_estado.map((item) => item.cantidad) || [],
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
      enabled: false,
    },
    title: {
      text: undefined,
    },
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
            y: item.cantidad,
            color:
              item.prioridad === "critica"
                ? "#DC2626"
                : item.prioridad === "alta"
                ? "#EA580C"
                : item.prioridad === "media"
                ? "#EAB308"
                : "#22C55E",
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
      enabled: false,
    },
    title: {
      text: undefined,
    },
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
      enabled: false,
    },
    title: {
      text: undefined,
    },
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
        data: siniestrosByMonth.map((item) => item.cantidad) || [],
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
        dataLabels: {
          enabled: true,
        },
      },
    },
  };

  // Configuración del mapa de México con siniestros por estado
  const mexicoMapChartOptions = useMemo((): Highcharts.Options => {
    if (!mexicoMapData || !stats?.siniestros_por_estado) {
      return {
        chart: {
          type: "map",
          height: 500,
        },
        accessibility: {
          enabled: false,
        },
        title: {
          text: "Cargando mapa...",
        },
      };
    }

    // Crear un mapa de códigos del mapa -> cantidad de siniestros
    // Los datos del backend ya vienen normalizados (ej: "Ciudad de México", "Puebla")
    const codigoMapaToCantidad = new Map<string, number>();
    stats.siniestros_por_estado.forEach((item) => {
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
          enabled: false,
        },
        title: {
          text: undefined,
        },
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
          formatter: function (this: Highcharts.TooltipFormatterContextObject) {
            const point = this.point as any;
            return `<b>${point.name || this.key}</b><br/>Siniestros: <b>${point.value || 0}</b>`;
          },
        },
        series: [
          {
            name: "Siniestros",
            type: "map",
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
      const nombreEstado = properties.name || properties.NAME || properties.NAME_1 || properties.admin || codigoMapa;
      
      // Buscar la cantidad de siniestros usando el código del mapa
      const cantidad = codigoMapaToCantidad.get(codigoMapa) || 0;

      return {
        "hc-key": codigoMapa,
        name: nombreEstado,
        value: cantidad,
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
        enabled: false,
      },
      title: {
        text: undefined,
      },
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
        formatter: function (this: Highcharts.TooltipFormatterContextObject) {
          const point = this.point as any;
          return `<b>${point.name || this.key}</b><br/>Siniestros: <b>${point.value || 0}</b>`;
        },
      },
      series: [
        {
          name: "Siniestros",
          type: "map",
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

  if (loading || loadingStats || !user) {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Bienvenido, {user?.full_name || user?.email}</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Mapa de México - Siniestros por Estado */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiMap className="w-5 h-5" />
          Siniestros por Estado en México
        </h3>
        {mapModuleReady && mexicoMapData && stats?.siniestros_por_estado.length > 0 ? (
          <HighchartsReact
            highcharts={Highcharts}
            constructorType={"mapChart"}
            options={mexicoMapChartOptions}
          />
        ) : mapModuleReady && mexicoMapData ? (
          <p className="text-gray-500 text-sm">No hay datos de siniestros por estado disponibles</p>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">Cargando mapa de México...</p>
            </div>
          </div>
        )}
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros por Estado - Gráfico de Barras */}
        <div className="bg-white rounded-lg shadow p-6">
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

        {/* Siniestros por Prioridad - Gráfico de Barras Horizontal */}
        <div className="bg-white rounded-lg shadow p-6">
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
      </div>

      {/* Gráficos secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros por Área - Gráfico de Dona */}
        <div className="bg-white rounded-lg shadow p-6">
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

        {/* Siniestros por Mes - Gráfico de Líneas */}
        <div className="bg-white rounded-lg shadow p-6">
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
      </div>

      {/* Siniestros Recientes y Actividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Siniestros Recientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiClock className="w-5 h-5" />
            Siniestros Recientes
          </h3>
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
                    {siniestro.fecha_siniestro && (
                      <div>Fecha: {new Date(siniestro.fecha_siniestro).toLocaleDateString("es-MX")}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay siniestros recientes</p>
          )}
        </div>

        {/* Actividades Recientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FiFileText className="w-5 h-5" />
            Actividades Recientes (últimas 24 horas)
          </h3>
          <div className="text-center py-8">
            <p className="text-3xl font-bold text-primary-600">{stats.actividades_recientes}</p>
            <p className="text-sm text-gray-600 mt-2">Actividades registradas en bitácora</p>
          </div>
        </div>
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${color} text-white p-4 rounded-lg`}>{icon}</div>
      </div>
    </div>
  );
}
