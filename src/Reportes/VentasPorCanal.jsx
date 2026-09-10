import React from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from "recharts";
import KroBiLoader from "@/components/KroBiLoader";
import KroBiNoData from "@/components/KroBiNoData";

function KpiCard({ title, value }) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
            <p className="text-xl font-bold text-krobi">{value}</p>
        </div>
    );
}

export default function VentasPorCanal({
    loading,
    datosCanal,
    formatoCOP,
    kpiVentas,
    kpiUnidades,
    kpiFacturas,
    kpiClientes,
    onResetFilters,
}) {
    // Métrica seleccionada para la gráfica
    const [metric, setMetric] = React.useState("total"); // total | unidades | facturas | clientes

    const formatoEntero = (v) => Number(v || 0).toLocaleString("es-CO");

    const metricLabelMap = {
        total: "Ventas (COP)",
        unidades: "Unidades",
        facturas: "Facturas",
        clientes: "Clientes",
    };

    const formatYAxisTick = (v) =>
        metric === "total" ? formatoCOP(v) : formatoEntero(v);

    const formatTooltipValue = (v) =>
        metric === "total" ? formatoCOP(v) : formatoEntero(v);

    // Agrupa para la gráfica (todas las métricas por canal)
    const dataCanalParaGrafica = Object.values(
        (datosCanal || []).reduce((acc, r) => {
            const k = r.tipo_canal || "Sin canal";

            if (!acc[k]) {
                acc[k] = {
                    tipo_canal: k,
                    total: 0,
                    unidades: 0,
                    facturas: 0,
                    clientes: 0,
                };
            }

            const row = acc[k];

            // Ventas
            row.total += Number(
                r.total ??
                r.total_ventas ??
                0
            );

            // Unidades
            row.unidades += Number(
                r.total_unidades ??
                r.cantidad ??
                0
            );

            // Facturas
            row.facturas += Number(
                r.total_facturas ??
                r.facturas ??
                0
            );

            // Clientes
            row.clientes += Number(
                r.total_clientes ??
                r.clientes ??
                0
            );

            return acc;
        }, {})
    );

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Ventas por Canal
                </h2>

                {/* Selector de métrica */}
                {(datosCanal?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Métrica
                        </span>
                        <select
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                            className="rounded-lg border px-2 py-1 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
                        >
                            <option value="total">Ventas (COP)</option>
                            <option value="unidades">Unidades</option>
                            <option value="facturas">Facturas</option>
                            {/* <option value="clientes">Clientes</option> */}
                        </select>
                    </div>
                )}
            </div>

            {loading ? (
                <KroBiLoader
                    message="Cargando magia de KroBi…"
                    subtext="Consultando Supabase y afinando filtros"
                    inline={false}
                />
            ) : (datosCanal?.length ?? 0) === 0 ? (
                <KroBiNoData
                    message="No hay resultados para los filtros seleccionados."
                    subtext="Prueba quitando alguno o usa el botón para limpiar."
                    onResetFilters={onResetFilters}
                />
            ) : (
                <>
                    {/* KPIs principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard title="Ventas Totales" value={formatoCOP(kpiVentas)} />
                        <KpiCard title="Unidades Vendidas" value={kpiUnidades.toLocaleString()} />
                        <KpiCard title="Facturas Emitidas" value={kpiFacturas.toLocaleString()} />
                        <KpiCard title="Clientes Únicos" value={kpiClientes.toLocaleString()} />
                    </div>

                    {/* Gráfica por canal */}
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={dataCanalParaGrafica} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="tipo_canal" />
                            <YAxis tickFormatter={formatYAxisTick} />
                            <Tooltip
                                formatter={(value) => formatTooltipValue(value)}
                                labelFormatter={(label) => `Canal: ${label}`}
                                cursor={{ fillOpacity: 0.1 }}
                            />
                            <Bar dataKey={metric} fill="#03A688" />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
}
