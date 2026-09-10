// src/pages/Reportes/Reportes/VentasPorVendedor.jsx
import React, { useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import KroBiLoader from "../components/KroBiLoader";
import KroBiNoData from "../components/KroBiNoData";

export default function VentasPorVendedor({
    loading,
    datosVendedor,
    formatoCOP,
    filtros,
    añosDisponibles,
    mesesDisponibles,
    tiendasDisponibles,
    onChangeFiltros,
    onResetFilters,
}) {
    // === Agrupar por nombre de vendedor ===
    const dataVendedorParaGrafica = useMemo(() => {
        const acumulado = (datosVendedor || []).reduce((acc, r) => {
            const k = r.nombre_vendedor || "Sin vendedor";
            acc[k] = (acc[k] || 0) + Number(r.total || r.total_ventas || 0);
            return acc;
        }, {});

        return Object.entries(acumulado).map(([nombre_vendedor, total]) => ({
            nombre_vendedor,
            total,
        }));
    }, [datosVendedor]);


    return (
        <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Ventas por Vendedor
            </h2>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <select
                    name="anio"
                    value={filtros.anio}
                    onChange={onChangeFiltros}
                    className="filtro"
                >
                    {añosDisponibles.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>

                <select
                    name="mes"
                    value={filtros.mes}
                    onChange={onChangeFiltros}
                    className="filtro"
                >
                    <option value="">Todos los meses</option>
                    {mesesDisponibles.map((m) => (
                        <option key={m.en} value={m.en}>
                            {m.es}
                        </option>
                    ))}
                </select>

                <select
                    name="tienda"
                    value={filtros.tienda}
                    onChange={onChangeFiltros}
                    className="filtro"
                >
                    <option value="">Todas las tiendas</option>
                    {tiendasDisponibles.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>

            {/* Resultados */}
            {loading ? (
                <KroBiLoader
                    message="Cargando magia de KroBi…"
                    subtext="Consultando Supabase y afinando filtros"
                    inline={false}
                />
            ) : dataVendedorParaGrafica.length === 0 ? (
                <KroBiNoData
                    message="No hay resultados para los filtros seleccionados."
                    subtext="Prueba quitando alguno o usa el botón para limpiar."
                    onResetFilters={onResetFilters}
                />
            ) : (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={dataVendedorParaGrafica}
                        margin={{ top: 16, right: 16, left: 8, bottom: 96 }} // espacio para etiquetas
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="nombre_vendedor"
                            interval={0}
                            angle={-80}
                            textAnchor="end"
                            height={90}
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis tickFormatter={(v) => formatoCOP(v)} />
                        <Tooltip
                            formatter={(v) => formatoCOP(v)}
                            labelFormatter={(l) => `Vendedor: ${l}`}
                        />
                        <Bar dataKey="total" fill="#03A688" />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
