import React, { useMemo, useState } from "react";


import Consolidado from "../Reportes/Consolidado";


const REPORTES = [
    { id: "consolidado", label: "Consolidado" },
    { id: "tienda", label: "Ventas por tienda" },
    { id: "canal", label: "Ventas por canal" },
];

const CATEGORIAS = ["Mujer", "Hombre", "Niño", "Niña", "Familia"];

export default function ReportesMobileLite() {
    const currentYear = new Date().getFullYear();

    const [selectedReporte, setSelectedReporte] = useState("consolidado");
    const [showFilters, setShowFilters] = useState(false);

    const [anio, setAnio] = useState(currentYear);
    const [mes, setMes] = useState(""); // "" = todos
    const [categorias, setCategorias] = useState([]); // 👈 sin <string[]>

    // Usamos 'categoria' (singular) para que Consolidado lo lea bien
    const filtros = useMemo(
        () => ({
            anio,
            mes,
            categoria: categorias,
        }),
        [anio, mes, categorias]
    );

    const handleToggleCategoria = (cat) => { // 👈 sin : string
        setCategorias((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="min-h-[100svh] bg-white dark:bg-gray-900 flex flex-col">
            {/* Header fijo */}
            <header className="sticky top-0 z-20 px-4 py-3 border-b border-gray-200/70 dark:border-gray-800/70 bg-white/90 dark:bg-gray-900/90 backdrop-blur">
                <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    Reportes (móvil)
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Selecciona un reporte y aplica filtros. Vista ligera con KPIs.
                </p>
            </header>

            {/* Selector de reporte + botón de filtros */}
            <section className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                            Tipo de reporte
                        </label>
                        <select
                            value={selectedReporte}
                            onChange={(e) => setSelectedReporte(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-700
                                       bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
                                       text-sm px-3 py-2"
                        >
                            {REPORTES.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="mt-5 shrink-0 inline-flex items-center gap-1 rounded-xl
                                   border border-krobi/70 text-krobi dark:text-krobi
                                   bg-white dark:bg-gray-900 text-xs font-medium px-3 py-2
                                   active:scale-[0.98] transition"
                    >
                        <span>Filtros</span>
                        <span className="text-base leading-none">+</span>
                    </button>
                </div>
            </section>

            {/* Panel de filtros (colapsable) */}
            {showFilters && (
                <section className="px-4 py-3 bg-gray-50/80 dark:bg-gray-950/80 border-b border-gray-200 dark:border-gray-800">
                    <div className="space-y-3 text-xs">
                        {/* Año + Mes */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                    Año
                                </label>
                                <select
                                    value={anio}
                                    onChange={(e) => setAnio(Number(e.target.value))}
                                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700
                                               bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
                                               text-xs px-3 py-2"
                                >
                                    {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                    Mes
                                </label>
                                <select
                                    value={mes}
                                    onChange={(e) => setMes(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700
                                               bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
                                               text-xs px-3 py-2"
                                >
                                    <option value="">Todos</option>
                                    {[
                                        "01",
                                        "02",
                                        "03",
                                        "04",
                                        "05",
                                        "06",
                                        "07",
                                        "08",
                                        "09",
                                        "10",
                                        "11",
                                        "12",
                                    ].map((m, idx) => {
                                        const nombres = [
                                            "Enero",
                                            "Febrero",
                                            "Marzo",
                                            "Abril",
                                            "Mayo",
                                            "Junio",
                                            "Julio",
                                            "Agosto",
                                            "Septiembre",
                                            "Octubre",
                                            "Noviembre",
                                            "Diciembre",
                                        ];
                                        return (
                                            <option key={m} value={m}>
                                                {nombres[idx]}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Categorías */}
                        <div>
                            <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">
                                Categorías
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIAS.map((c) => {
                                    const checked = categorias.includes(c);
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => handleToggleCategoria(c)}
                                            className={[
                                                "px-3 py-1 rounded-full text-[11px] border transition",
                                                checked
                                                    ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
                                                    : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700",
                                            ].join(" ")}
                                        >
                                            {c}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Botón cerrar panel */}
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => setShowFilters(false)}
                                className="text-[11px] text-gray-500 dark:text-gray-400 underline underline-offset-2"
                            >
                                Aplicar y cerrar
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Contenido del reporte */}
            <main className="flex-1 px-4 pb-6 pt-3 bg-white dark:bg-gray-900">
                {/* <Suspense
                    fallback={
                        <KroBiLoader
                            message="Cargando KPIs…"
                            subtext="Consultando datos para la vista móvil"
                        />
                    }
                > */}
                {selectedReporte === "consolidado" && (
                    <Consolidado
                        mobileLite
                        filtros={filtros}
                        maxRows={50}
                        chartHeight={240}
                        disableExports
                        kpiCompact
                    />
                )}

                {selectedReporte !== "consolidado" && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 border border-dashed rounded-xl p-4">
                        El reporte{" "}
                        <span className="font-semibold">
                            {
                                REPORTES.find((r) => r.id === selectedReporte)?.label ??
                                "seleccionado"
                            }
                        </span>{" "}
                        estará disponible en versión móvil próximamente.
                        <br />
                        Por ahora, consulta este reporte desde la versión web en computador.
                    </div>
                )}
                {/* </Suspense> */}
            </main>
        </div>
    );
}
