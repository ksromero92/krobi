// src/Reportes/Inventarios.jsx
// 1) Stock actual (snapshot): v_inventarios_stock_actual -> última fecha por ubicacion_fisica y último registro por producto en ese corte
// 2) Histórico: inventarios con rango de fechas
// Filtros Stock: Ubicación física, Nombre de producto
// Filtros Histórico: Ubicación física, Nombre de producto, Desde/Hasta
// Agrupar: Producto (Top 15 si no hay selección), Ubicación, (Fecha sólo histórico)

import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import {
    ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { Download } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";

const supabase = getSupabase();
const PAGE_SIZE = 1000;

// UI tokens
const PRIMARY = "#03A688";
const BORDER_LIGHT = "#e5e7eb";
const BORDER_DARK = "#3f3f46";
const TEXT_LIGHT = "#111827";
const TEXT_DARK = "#f3f4f6";
const GRID_LIGHT = "rgba(17,24,39,.08)";
const GRID_DARK = "rgba(243,244,246,.12)";
const AXIS_LIGHT = "#374151";
const AXIS_DARK = "#e5e7eb";

// Helpers
function toYMDLocal(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const today = toYMDLocal(new Date());
const thirtyAgo = toYMDLocal(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

async function fetchAll(buildQuery, page = PAGE_SIZE) {
    let all = [], from = 0;
    while (true) {
        const to = from + page - 1;
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        if (data && data.length) all = all.concat(data);
        if (!data || data.length < page) break;
        from += page;
    }
    return all;
}

function toDistinctSorted(values) {
    const set = new Set();
    for (const v of values ?? []) {
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (!s) continue;
        set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function downloadCsv(filename, rows, mode) {
    if (!rows || rows.length === 0) return;
    const headers = [
        "mode", "id_inventario", "fecha_conteo", "cantidad", "fuente", "tipo_inventario", "ubicacion_fisica", "nombre_producto",
    ];
    const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[\",\n;]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
        const obj = {
            mode,
            id_inventario: r.id_inventario,
            fecha_conteo: r.fecha_conteo,
            cantidad: r.cantidad,
            fuente: r.fuente,
            tipo_inventario: r.tipo_inventario,
            ubicacion_fisica: r?.ubicacion_fisica ?? "-",
            nombre_producto: r?.nombre_producto ?? "-",
        };
        lines.push(headers.map((h) => esc(obj[h])).join(","));
    }
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

const customSelectStyles = (isDark) => ({
    control: (base) => ({
        ...base,
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
        borderColor: isDark ? "#374151" : "#d1d5db",
        color: isDark ? "#f3f4f6" : "#111827",
        borderRadius: "0.75rem",
        minHeight: "2.5rem",
        padding: "0 0.25rem",
        boxShadow: "none",
        "&:hover": { borderColor: isDark ? "#4b5563" : "#9ca3af" },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
        borderRadius: "0.75rem",
        zIndex: 30,
    }),
    option: (base, { isFocused, isSelected }) => ({
        ...base,
        backgroundColor: isSelected
            ? "#03A688"
            : isFocused
                ? isDark ? "#374151" : "#f3f4f6"
                : "transparent",
        color: isSelected ? "#ffffff" : isDark ? "#f9fafb" : "#111827",
        cursor: "pointer",
    }),
});

export default function ReporteInventarios() {
    // Tema
    const [isDark, setIsDark] = useState(
        typeof document !== "undefined" && document.documentElement.classList.contains("dark")
    );
    useEffect(() => {
        if (typeof document === "undefined") return;
        const el = document.documentElement;
        const obs = new MutationObserver(() => {
            setIsDark(el.classList.contains("dark"));
        });
        obs.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);

    // Modo: "stock" | "historico"
    const [mode, setMode] = useState("stock");

    // Filtros
    const [filtros, setFiltros] = useState({
        ubicacion_fisica: "",
        nombre_producto: "",
        // Sólo histórico
        desde: thirtyAgo,
        hasta: today,
        groupBy: "producto", // producto | ubicacion | fecha (fecha sólo histórico)
    });

    // Catálogos
    const [opt, setOpt] = useState({
        ubicacionesStock: [],
        ubicacionesHist: [],
        nombresProductoStock: [],
        nombresProductoHist: [],
    });

    // Data
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Tokens tema
    const axisColor = isDark ? AXIS_DARK : AXIS_LIGHT;
    const gridColor = isDark ? GRID_DARK : GRID_LIGHT;
    const borderColor = isDark ? BORDER_DARK : BORDER_LIGHT;
    const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;

    // Cargar catálogos
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const qUbicStock = () =>
                    supabase.from("v_inventarios_stock_actual")
                        .select("ubicacion_fisica")
                        .not("ubicacion_fisica", "is", null)
                        .order("ubicacion_fisica", { ascending: true });

                const qUbicHist = () =>
                    supabase.from("inventarios")
                        .select("ubicacion_fisica")
                        .not("ubicacion_fisica", "is", null)
                        .order("ubicacion_fisica", { ascending: true });

                const qProdStock = () =>
                    supabase.from("v_inventarios_stock_actual")
                        .select("nombre_producto")
                        .not("nombre_producto", "is", null)
                        .order("nombre_producto", { ascending: true });

                const qProdHist = () =>
                    supabase.from("inventarios")
                        .select("nombre_producto")
                        .not("nombre_producto", "is", null)
                        .order("nombre_producto", { ascending: true });

                const [uS, uH, pS, pH] = await Promise.all([
                    fetchAll(qUbicStock, 2000),
                    fetchAll(qUbicHist, 2000),
                    fetchAll(qProdStock, 2000),
                    fetchAll(qProdHist, 2000),
                ]);
                if (!alive) return;

                setOpt({
                    ubicacionesStock: toDistinctSorted(uS.map(r => r.ubicacion_fisica || "")),
                    ubicacionesHist: toDistinctSorted(uH.map(r => r.ubicacion_fisica || "")),
                    nombresProductoStock: toDistinctSorted(pS.map(r => r.nombre_producto || "")),
                    nombresProductoHist: toDistinctSorted(pH.map(r => r.nombre_producto || "")),
                });
            } catch (e) { console.error(e); }
        })();
        return () => { alive = false; };
    }, []);

    // Query builders
    const buildStockQuery = () => {
        let q = supabase
            .from("v_inventarios_stock_actual")
            .select(`
        id_inventario,
        ubicacion_fisica,
        id_producto,
        nombre_producto,
        cantidad,
        fecha_conteo,
        fuente,
        tipo_inventario
      `);

        if (filtros.ubicacion_fisica) q = q.eq("ubicacion_fisica", filtros.ubicacion_fisica);
        if (filtros.nombre_producto) q = q.eq("nombre_producto", filtros.nombre_producto);

        return q.order("ubicacion_fisica", { ascending: true })
            .order("nombre_producto", { ascending: true });
    };

    const buildHistoricQuery = () => {
        let q = supabase
            .from("inventarios")
            .select(`
        id_inventario,
        ubicacion_fisica,
        nombre_producto,
        fecha_conteo,
        cantidad,
        fuente,
        tipo_inventario
      `)
            .gte("fecha_conteo", filtros.desde)
            .lte("fecha_conteo", filtros.hasta);

        if (filtros.ubicacion_fisica) q = q.eq("ubicacion_fisica", filtros.ubicacion_fisica);
        if (filtros.nombre_producto) q = q.eq("nombre_producto", filtros.nombre_producto);

        return q.order("fecha_conteo", { ascending: true });
    };

    // Buscar
    const buscar = async () => {
        setError(null);
        setLoading(true);
        try {
            const data = await fetchAll(
                () => (mode === "stock" ? buildStockQuery() : buildHistoricQuery()),
                2000
            );
            setRows(data || []);
        } catch (e) {
            console.error(e);
            setRows([]);
            setError(e?.message ?? "Error al cargar inventarios");
        } finally {
            setLoading(false);
        }
    };

    // Auto-buscar
    useEffect(() => {
        buscar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, filtros.ubicacion_fisica, filtros.nombre_producto, filtros.desde, filtros.hasta]);

    // Agrupación + Top 15
    const isTop15Mode = filtros.groupBy === "producto" && !filtros.nombre_producto;

    const grouped = useMemo(() => {
        const keyBy = (r) => {
            if (filtros.groupBy === "ubicacion") {
                return (r?.ubicacion_fisica || "Sin ubicación").toString();
            }
            if (mode === "historico" && filtros.groupBy === "fecha") {
                return String(r?.fecha_conteo || "").slice(0, 10) || "Sin fecha";
            }
            // producto
            return (r?.nombre_producto || "Sin producto").toString();
        };

        const acc = new Map();
        for (const r of rows) {
            const k = keyBy(r);
            const curr = acc.get(k) || { grupo: k, cantidad: 0 };
            curr.cantidad += Number(r.cantidad || 0);
            acc.set(k, curr);
        }

        let arr = Array.from(acc.values());

        if (mode === "historico" && filtros.groupBy === "fecha") {
            arr.sort((a, b) => String(a.grupo).localeCompare(String(b.grupo)));
            return arr;
        }

        if (filtros.groupBy === "producto") {
            if (!filtros.nombre_producto) {
                arr.sort((a, b) => (b.cantidad - a.cantidad) || String(a.grupo).localeCompare(String(b.grupo), "es"));
                return arr.slice(0, 15);
            }
            arr.sort((a, b) => String(a.grupo).localeCompare(String(b.grupo), "es"));
            return arr;
        }

        // ubicacion
        arr.sort((a, b) => String(a.grupo).localeCompare(String(b.grupo), "es"));
        return arr;
    }, [rows, filtros.groupBy, filtros.nombre_producto, mode]);

    // KPI: fecha de corte máxima (por ítem; útil como referencia)
    const maxFecha = useMemo(() => {
        let max = null;
        for (const r of rows) {
            if (!r?.fecha_conteo) continue;
            const f = String(r.fecha_conteo).slice(0, 10);
            if (!max || f > max) max = f;
        }
        return max;
    }, [rows]);

    const yFmt = (v) => new Intl.NumberFormat("es-CO").format(v);
    const toOptions = (arr) => arr.map((v) => ({ value: v, label: v || "(vacío)" }));

    const groupOptionsStock = [
        { value: "producto", label: "Producto" },
        { value: "ubicacion", label: "Ubicación" },
    ];
    const groupOptionsHist = [
        { value: "producto", label: "Producto" },
        { value: "ubicacion", label: "Ubicación" },
        { value: "fecha", label: "Fecha" },
    ];

    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold" style={{ color: textColor }}>Inventarios</h1>
                    <div className="ml-2 inline-flex rounded-2xl overflow-hidden border" style={{ borderColor: borderColor }}>
                        <button
                            className={`px-3 py-1 text-sm ${mode === "stock" ? "text-white" : ""}`}
                            style={{ backgroundColor: mode === "stock" ? PRIMARY : "transparent" }}
                            onClick={() => setMode("stock")}
                        >
                            Stock actual
                        </button>
                        <button
                            className={`px-3 py-1 text-sm ${mode === "historico" ? "text-white" : ""}`}
                            style={{ backgroundColor: mode === "historico" ? PRIMARY : "transparent" }}
                            onClick={() => setMode("historico")}
                        >
                            Histórico
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => downloadCsv(`inventarios_${mode}_${toYMDLocal(new Date())}.csv`, rows, mode)}
                        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm shadow-sm hover:shadow"
                        style={{ border: `1px solid ${borderColor}`, color: textColor }}
                        disabled={rows.length === 0}
                        title={rows.length === 0 ? "Sin datos para exportar" : "Exportar CSV"}
                    >
                        <Download className="h-4 w-4" /> Exportar CSV
                    </button>
                    <button
                        onClick={buscar}
                        className="rounded-2xl px-4 py-2 text-sm shadow hover:opacity-95 text-white"
                        style={{ backgroundColor: PRIMARY }}
                    >
                        Aplicar filtros
                    </button>
                </div>
            </div>

            {/* Nota de corte en snapshot */}
            {mode === "stock" && (
                <div className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Mostrando el último conteo por <strong>ubicación física</strong> (corte propio de cada ubicación) y último registro por producto en ese corte.
                    {maxFecha ? ` Fecha máxima observada: ${maxFecha}.` : ""}
                </div>
            )}

            {/* Filtros */}
            <div
                className={`grid ${mode === "stock" ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-6"} gap-3 p-3 rounded-2xl`}
                style={{ border: `1px solid ${borderColor}`, backgroundColor: isDark ? "#0b0b0f" : "#ffffff" }}
            >
                {/* Ubicación física */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Ubicación física</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...(mode === "stock" ? opt.ubicacionesStock : opt.ubicacionesHist)])}
                        value={{ value: filtros.ubicacion_fisica, label: filtros.ubicacion_fisica || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, ubicacion_fisica: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Nombre de producto */}
                <div className="flex flex-col md:col-span-2">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Nombre de producto</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...(mode === "stock" ? opt.nombresProductoStock : opt.nombresProductoHist)])}
                        value={{ value: filtros.nombre_producto, label: filtros.nombre_producto || "Todos" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, nombre_producto: v?.value ?? "" }))}
                        placeholder="Todos"
                        isClearable
                    />
                </div>

                {/* Fechas (solo histórico) */}
                {mode === "historico" && (
                    <>
                        <div className="flex flex-col">
                            <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Desde</label>
                            <input
                                type="date"
                                value={filtros.desde}
                                onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
                                className="mt-1 rounded-xl border px-3 py-2 text-sm"
                                style={{ borderColor: borderColor, backgroundColor: isDark ? "#1f2937" : "#ffffff", color: textColor }}
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Hasta</label>
                            <input
                                type="date"
                                value={filtros.hasta}
                                onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
                                className="mt-1 rounded-xl border px-3 py-2 text-sm"
                                style={{ borderColor: borderColor, backgroundColor: isDark ? "#1f2937" : "#ffffff", color: textColor }}
                            />
                        </div>
                    </>
                )}

                {/* Agrupar por */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Agrupar por</label>
                    <select
                        value={filtros.groupBy}
                        onChange={(e) => setFiltros((f) => ({ ...f, groupBy: e.target.value }))}
                        className="mt-1 rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: borderColor, backgroundColor: isDark ? "#1f2937" : "#ffffff", color: textColor }}
                    >
                        {(mode === "stock"
                            ? [{ value: "producto", label: "Producto" }, { value: "ubicacion", label: "Ubicación" }]
                            : [{ value: "producto", label: "Producto" }, { value: "ubicacion", label: "Ubicación" }, { value: "fecha", label: "Fecha" }]
                        ).map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {filtros.groupBy === "producto" && !filtros.nombre_producto && (
                        <span className="mt-1 text-[10px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                            Mostrando <strong>Top 15</strong> por cantidad.
                        </span>
                    )}
                </div>
            </div>

            {/* Gráfica */}
            <div className="rounded-2xl p-3" style={{ border: `1px solid ${borderColor}`, backgroundColor: isDark ? "#0b0b0f" : "#ffffff" }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium" style={{ color: textColor }}>
                        {mode === "stock"
                            ? (filtros.groupBy === "producto" && !filtros.nombre_producto
                                ? "Top 15 productos por cantidad (Stock actual)"
                                : `Stock actual por ${filtros.groupBy === "ubicacion" ? "ubicación" : "producto"}`)
                            : (filtros.groupBy === "producto" && !filtros.nombre_producto
                                ? "Top 15 productos por cantidad (Histórico)"
                                : `Cantidad total por ${filtros.groupBy}`)}
                    </div>
                </div>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={grouped} margin={{ top: 10, right: 16, left: 8, bottom: 24 }}>
                            <CartesianGrid stroke={gridColor} />
                            <XAxis
                                dataKey="grupo"
                                tick={{ fontSize: 11, fill: axisColor }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis tick={{ fill: axisColor }} tickFormatter={(v) => new Intl.NumberFormat("es-CO").format(v)} />
                            <Tooltip
                                formatter={(v) => new Intl.NumberFormat("es-CO").format(v)}
                                labelFormatter={(l) => `${filtros.groupBy}: ${l}`}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: `1px solid ${borderColor}`,
                                    background: isDark ? "#111827" : "#ffffff",
                                    color: textColor,
                                }}
                            />
                            <Bar dataKey="cantidad" stroke={PRIMARY} fill={PRIMARY} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Mensajes */}
            {loading && <div className="text-sm" style={{ color: isDark ? "#d1d5db" : "#4b5563" }}>Cargando…</div>}
            {error && <div className="text-sm" style={{ color: "#ef4444" }}>{error}</div>}
        </div>
    );
}
