// src/reportes/VentasDetalle.jsx
// KroBi – Reporte "Ventas a Detalle" (estilos alineados al dashboard)
// React + Supabase + react-select + Tailwind (dark) + Recharts

import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Download } from "lucide-react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Brush,
} from "recharts";
import { getSupabase } from '@/lib/supabaseClient';


// ============================ Configuración =============================
const DETAIL_VIEW = "v_ventas_detalle";
const CATALOG_VIEW = "v_consolidado_general_reconc";
const TIENDA_VIEW = "v_ventas_por_tienda";
const PAGE_SIZE = 1000;
const MAX_DAYS = 93;
const supabase = getSupabase();
// Paleta / tokens (alineado a tu select: #03A688)
const PRIMARY = "#03A688";
const BORDER_LIGHT = "#e5e7eb";   // gray-200
const BORDER_DARK = "#3f3f46";   // zinc-700
const TEXT_LIGHT = "#111827";   // gray-900
const TEXT_DARK = "#f3f4f6";   // gray-100
const GRID_LIGHT = "rgba(17,24,39,.08)";  // grid light
const GRID_DARK = "rgba(243,244,246,.12)"; // grid dark
const AXIS_LIGHT = "#374151";   // gray-700
const AXIS_DARK = "#e5e7eb";   // gray-200

// ============================ Helpers =============================
// YYYY-MM-DD en zona local (evita desfase UTC)
function toYMDLocal(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const fmtDate = (s) => toYMDLocal(new Date(s));

function daysBetween(a, b) {
    const d1 = new Date(a + "T00:00:00");
    const d2 = new Date(b + "T00:00:00");
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Paginación (trae todo en páginas)
async function fetchAll(buildQuery, pageSize = PAGE_SIZE) {
    let all = [], from = 0;
    while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw error;
        if (data && data.length) all = all.concat(data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

// OR combinado para print/color
function buildPrintColorOr(values) {
    if (!values || values.length === 0) return "";
    const escaped = values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",");
    return `print.in.(${escaped}),color.in.(${escaped})`;
}

// Normalizar canal para UI
function normalizeCanal(s) {
    if (!s) return "Sin canal";
    const t = String(s).toLowerCase();
    if (/f[ií]sica|f[ií]sico/.test(t)) return "Físico";
    return s;
}

// Distintos ordenados (para selects)
function toDistinctSorted(values, { lower = false, normalize = false } = {}) {
    const set = new Set();
    for (const v of values ?? []) {
        if (v === null || v === undefined) continue;
        let s = String(v).trim();
        if (!s) continue;
        if (normalize) s = normalizeCanal(s);
        if (lower) s = s.toLowerCase();
        set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

// Canon para comparar texto con espacios/acentos raros
function canon(s) {
    return String(s ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

// CSV (UTF-8 con BOM para Excel)
function downloadCsv(filename, rows) {
    const headers = [
        "fecha_emision",
        "numero",
        "nombre_tienda",
        "tipo_canal",
        "id_cliente_final",
        "categoria",
        "silueta",
        "tipo_prenda",
        "talla",
        "print",
        "color",
        "cantidad",
        "precio_unitario",
        "total",
    ];
    const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n;]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows || []) lines.push(headers.map((h) => esc(r[h])).join(","));
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

const nfCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const nfInt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// === Estilos react-select (idénticos a Reportes.jsx) ===
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
        "&:hover": { borderColor: isDark ? "#4b5563" : "#9ca3af" }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
        borderRadius: "0.75rem",
        zIndex: 30
    }),
    option: (base, { isFocused, isSelected }) => ({
        ...base,
        backgroundColor: isSelected
            ? "#03A688"
            : isFocused
                ? (isDark ? "#374151" : "#f3f4f6")
                : "transparent",
        color: isSelected ? "#ffffff" : (isDark ? "#f9fafb" : "#111827"),
        cursor: "pointer"
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: isDark ? "#374151" : "#e5e7eb",
        borderRadius: "0.5rem",
        padding: "0 4px"
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: isDark ? "#f9fafb" : "#111827"
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: isDark ? "#9ca3af" : "#6b7280",
        ":hover": { backgroundColor: isDark ? "#4b5563" : "#d1d5db", color: "#111827" }
    })
});

// ============================ Componente =============================
export default function ReporteVentasDetalle() {
    // Rango por defecto = últimos 7 días
    const today = toYMDLocal(new Date());
    const sevenAgo = toYMDLocal(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

    const [filtros, setFiltros] = useState({
        desde: sevenAgo,
        hasta: today,
        canal: "",
        tienda: "",
        categoria: [], // multi
        silueta: "",
        tipo_prenda: "",
        talla: "",
        coleccion: "",
        print_o_color: [], // multi
    });
    const [categoriaPorFactura, setCategoriaPorFactura] = useState(false);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metric, setMetric] = useState("total"); // total | unidades | facturas | clientes

    // Select options (reutiliza vistas existentes)
    const [opt, setOpt] = useState({
        canales: [],
        tiendas: [],
        categorias: [],
        siluetas: [],
        tiposPrenda: [],
        tallas: [],
        printsColors: [],
        colecciones: [],
    });

    // Modo oscuro reactivo (observa cambios en la clase 'dark' del <html>)
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

    // Cargar catálogos (una vez)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const buildCats = () =>
                    supabase
                        .from(CATALOG_VIEW)
                        .select("categoria,silueta,tipo_prenda,talla,print,color,coleccion")
                        .order("categoria", { ascending: true });
                const buildTiendas = () =>
                    supabase
                        .from(TIENDA_VIEW)
                        .select("nombre_tienda,tipo_canal")
                        .order("nombre_tienda", { ascending: true });

                // const [cats, tiendas] = await Promise.all([fetchAll(buildCats, PAGE_SIZE), fetchAll(buildTiendas, PAGE_SIZE)]); fix colecciones
                const buildProdCols = () =>
                    supabase.from("productos").select("coleccion").neq("coleccion", null).order("coleccion", { ascending: true });
                const [cats, tiendas, prodCols] = await Promise.all([
                    fetchAll(buildCats, PAGE_SIZE),
                    fetchAll(buildTiendas, PAGE_SIZE),
                    fetchAll(buildProdCols, PAGE_SIZE),
                ]);




                if (!alive) return;

                const categorias = toDistinctSorted(cats.map((r) => r.categoria), { lower: true });
                const siluetas = toDistinctSorted(cats.map((r) => r.silueta), { lower: true });
                const tiposPrenda = toDistinctSorted(cats.map((r) => r.tipo_prenda), { lower: true });
                const tallas = toDistinctSorted(cats.map((r) => r.talla), { lower: true });
                const prints = toDistinctSorted(cats.map((r) => r.print));
                const colors = toDistinctSorted(cats.map((r) => r.color));
                const printsColors = toDistinctSorted([...prints, ...colors]);
                const tiendasOpt = toDistinctSorted(tiendas.map((r) => r.nombre_tienda));
                const canales = toDistinctSorted(tiendas.map((r) => r.tipo_canal), { normalize: true });
                // const colecciones = toDistinctSorted(cats.map((r) => r.coleccion), { lower: true });
                const colecciones = toDistinctSorted(
                    [...cats.map((r) => r.coleccion), ...prodCols.map((r) => r.coleccion)],
                    { lower: true }
                );

                setOpt({ canales, tiendas: tiendasOpt, categorias, siluetas, tiposPrenda, tallas, printsColors, colecciones });
            } catch (e) { console.error(e); }
        })();
        return () => { alive = false; };
    }, []);

    // Builder de query (permite saltar el filtro de tienda en fallback)
    const buildDetalleQuery = (opts = {}) => {
        const { skipTienda = false } = opts;
        let q = supabase
            .from(DETAIL_VIEW)
            .select(
                "fecha_emision,numero,nombre_tienda,tipo_canal,id_cliente_final,categoria,silueta,tipo_prenda,talla,print,color,cantidad,precio_unitario,total,cats,public_url"
            )
            .gte("fecha_emision", filtros.desde)
            .lte("fecha_emision", filtros.hasta);

        if (filtros.canal) {
            if (filtros.canal === "Físico") q = q.in("tipo_canal", ["Físico", "Física"]);
            else q = q.eq("tipo_canal", filtros.canal);
        }
        if (!skipTienda && filtros.tienda) q = q.eq("nombre_tienda", filtros.tienda);
        if (filtros.categoria?.length > 0 && !categoriaPorFactura)
            q = q.in("categoria", filtros.categoria.map((c) => c.toLowerCase()));
        if (filtros.silueta) q = q.eq("silueta", filtros.silueta.toLowerCase());
        if (filtros.tipo_prenda) q = q.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
        if (filtros.talla) q = q.eq("talla", filtros.talla.toLowerCase());
        if (filtros.print_o_color?.length > 0) {
            const orStr = buildPrintColorOr(filtros.print_o_color);
            if (orStr) q = q.or(orStr);
        }
        if (filtros.coleccion) q = q.eq("coleccion", String(filtros.coleccion).toLowerCase().trim());

        if (categoriaPorFactura && filtros.categoria.length > 0) {
            const cats = filtros.categoria.map((c) => String(c).toLowerCase().trim());
            q = q.contains("cats", cats);
        }
        // Orden estable ANTES de paginar
        q = q.order("fecha_emision", { ascending: true }).order("numero", { ascending: true });
        return q;
    };

    // Buscar (auto con cambios de filtros)
    const buscar = async () => {
        setError(null);
        const diff = daysBetween(filtros.desde, filtros.hasta);
        if (diff < 0) {
            setRows([]);
            setError("El rango de fechas es inválido (Desde > Hasta).");
            return;
        }
        if (diff > MAX_DAYS) {
            setRows([]);
            setError(`Rango demasiado amplio (${diff} días). Máximo permitido: ${MAX_DAYS} días.`);
            return;
        }
        setLoading(true);
        try {
            let data;
            try {
                data = await fetchAll(() => buildDetalleQuery({ skipTienda: false }), PAGE_SIZE);
            } catch (e) {
                // Fallback: si la vista rompe sólo cuando hay tienda, pide sin tienda y filtra local
                if (filtros.tienda) {
                    const all = await fetchAll(() => buildDetalleQuery({ skipTienda: true }), PAGE_SIZE);
                    const tCanon = canon(filtros.tienda);
                    data = (all || []).filter((r) => canon(r?.nombre_tienda) === tCanon);
                } else {
                    throw e;
                }
            }
            const normalized = (data || []).map((r) => ({ ...r, tipo_canal: normalizeCanal(r.tipo_canal) }));
            setRows(normalized);
        } catch (e) {
            console.error(e);
            setError(e?.message ?? "Error al cargar Ventas a Detalle");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    // KPIs a partir del detalle
    const kpis = useMemo(() => {
        let total = 0, unidades = 0;
        const facturas = new Set(), clientes = new Set();
        for (const r of rows) {
            total += Number(r.total) || 0;
            unidades += Number(r.cantidad) || 0;
            if (r.numero) facturas.add(String(r.numero));
            if (r.id_cliente_final) clientes.add(String(r.id_cliente_final));
        }
        return { total, unidades, facturas: facturas.size, clientes: clientes.size };
    }, [rows]);

    // Serie diaria (x = fecha)
    const daily = useMemo(() => {
        const map = new Map();
        for (const r of rows) {
            const d = String(r.fecha_emision).slice(0, 10);
            if (!map.has(d))
                map.set(d, { fecha: d, total: 0, unidades: 0, facturas: new Set(), clientes: new Set() });
            const o = map.get(d);
            o.total += Number(r.total) || 0;
            o.unidades += Number(r.cantidad) || 0;
            if (r.numero) o.facturas.add(String(r.numero));
            if (r.id_cliente_final) o.clientes.add(String(r.id_cliente_final));
        }
        return Array.from(map.values())
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .map((o) => ({
                fecha: o.fecha,
                total: o.total,
                unidades: o.unidades,
                facturas: o.facturas.size,
                clientes: o.clientes.size,
            }));
    }, [rows]);

    // Auto-buscar en primera carga y cada vez que cambien filtros
    useEffect(() => {
        buscar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtros, categoriaPorFactura]);

    // UI helpers
    const toOptions = (arr) => arr.map((v) => ({ value: v, label: v || "(vacío)" }));
    const yFmt = (v) => (metric === "total" ? nfCOP.format(v) : nfInt.format(v));

    // Tokens de color según modo
    const axisColor = isDark ? AXIS_DARK : AXIS_LIGHT;
    const gridColor = isDark ? GRID_DARK : GRID_LIGHT;
    const borderColor = isDark ? BORDER_DARK : BORDER_LIGHT;
    const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;

    return (
        <div className="w-full space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold" style={{ color: textColor }}>Ventas a Detalle</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => downloadCsv(`ventas_detalle_${filtros.desde}_a_${filtros.hasta}.csv`, rows)}
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

            {/* Filtros */}
            <div
                className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-2xl"
                style={{
                    border: `1px solid ${borderColor}`,
                    backgroundColor: isDark ? "#0b0b0f" : "#ffffff"
                }}
            >
                {/* Fechas */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Desde</label>
                    <input
                        type="date"
                        value={filtros.desde}
                        onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
                        className="mt-1 rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: borderColor, backgroundColor: isDark ? "#1f2937" : "#ffffff", color: textColor }}
                    />
                    <span className="mt-1 text-[10px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                        Máx. {MAX_DAYS} días
                    </span>
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

                {/* Canal */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Canal</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.canales])}
                        value={{ value: filtros.canal, label: filtros.canal || "Todos" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, canal: v?.value ?? "" }))}
                        placeholder="Todos"
                    />
                </div>

                {/* Tienda */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Tienda</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.tiendas])}
                        value={{ value: filtros.tienda, label: filtros.tienda || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, tienda: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Categoría (multi) */}
                <div className="flex flex-col md:col-span-2">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Categoría (multi)</label>
                    <Select
                        isMulti
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(opt.categorias)}
                        value={(filtros.categoria || []).map((c) => ({ value: c, label: c }))}
                        onChange={(vals) => setFiltros((f) => ({ ...f, categoria: (vals ?? []).map((x) => x.value) }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Silueta */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Silueta</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.siluetas])}
                        value={{ value: filtros.silueta, label: filtros.silueta || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, silueta: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Tipo de prenda */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Tipo de prenda</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.tiposPrenda])}
                        value={{ value: filtros.tipo_prenda, label: filtros.tipo_prenda || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, tipo_prenda: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Talla */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Talla</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.tallas])}
                        value={{ value: filtros.talla, label: filtros.talla || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, talla: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Colección */}
                <div className="flex flex-col">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Colección</label>
                    <Select
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(["", ...opt.colecciones])}
                        value={{ value: filtros.coleccion, label: filtros.coleccion || "Todas" }}
                        onChange={(v) => setFiltros((f) => ({ ...f, coleccion: v?.value ?? "" }))}
                        placeholder="Todas"
                    />
                </div>

                {/* Print / Color (multi) */}
                <div className="flex flex-col md:col-span-2">
                    <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Print / Color (multi)</label>
                    <Select
                        isMulti
                        classNamePrefix="rs"
                        styles={customSelectStyles(isDark)}
                        menuPortalTarget={document.body}
                        options={toOptions(opt.printsColors)}
                        value={(filtros.print_o_color || []).map((c) => ({ value: c, label: c }))}
                        onChange={(vals) => setFiltros((f) => ({ ...f, print_o_color: (vals ?? []).map((x) => x.value) }))}
                        placeholder="Todos"
                    />
                </div>

                {/* Switch cats cs [] */}
                <div className="flex items-center gap-2 md:col-span-2">
                    <input
                        id="switch-cat"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={categoriaPorFactura}
                        onChange={(e) => setCategoriaPorFactura(e.target.checked)}
                    />
                    <label htmlFor="switch-cat" className="text-sm" style={{ color: textColor }}>
                        Categoría por factura (usar cats cs [])
                    </label>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi title="Total" value={nfCOP.format(kpis.total)} isDark={isDark} />
                <Kpi title="Unidades" value={nfInt.format(kpis.unidades)} isDark={isDark} />
                <Kpi title="Facturas" value={nfInt.format(kpis.facturas)} isDark={isDark} />
                <Kpi title="Clientes" value={nfInt.format(kpis.clientes)} isDark={isDark} />
            </div>

            {/* Gráfica diaria (colores exactos) */}
            <div
                className="rounded-2xl p-3"
                style={{ border: `1px solid ${borderColor}`, backgroundColor: isDark ? "#0b0b0f" : "#ffffff" }}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium" style={{ color: textColor }}>Serie diaria</div>
                    <div className="flex items-center gap-2 text-sm">
                        <label className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>Métrica</label>
                        <select
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                            className="rounded-lg border px-2 py-1 text-sm"
                            style={{ borderColor: borderColor, backgroundColor: isDark ? "#1f2937" : "#ffffff", color: textColor }}
                        >
                            <option value="total">Total (COP)</option>
                            <option value="unidades">Unidades</option>
                            <option value="facturas">Facturas</option>
                            <option value="clientes">Clientes</option>
                        </select>
                    </div>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={daily} margin={{ top: 10, right: 16, left: 8, bottom: 24 }}>
                            <CartesianGrid stroke={gridColor} />
                            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: axisColor }} />
                            <YAxis tick={{ fill: axisColor }} tickFormatter={(v) => (metric === "total" ? nfCOP.format(v) : nfInt.format(v))} />
                            <Tooltip
                                formatter={(v) => (metric === "total" ? nfCOP.format(v) : nfInt.format(v))}
                                labelFormatter={(l) => `Fecha: ${l}`}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: `1px solid ${borderColor}`,
                                    background: isDark ? "#111827" : "#ffffff",
                                    color: textColor,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey={metric}
                                stroke={PRIMARY}
                                strokeWidth={2}
                                fill={PRIMARY}
                                fillOpacity={0.15}
                            />
                            <Brush dataKey="fecha" travellerWidth={8} height={20} stroke={PRIMARY} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {loading && <div className="text-sm" style={{ color: isDark ? "#d1d5db" : "#4b5563" }}>Cargando…</div>}
            {error && <div className="text-sm" style={{ color: "#ef4444" }}>{error}</div>}

            {/* Tabla */}
            <div className="overflow-auto rounded-2xl" style={{ border: `1px solid ${borderColor}` }}>
                <table className="min-w-full text-sm" style={{ color: textColor }}>
                    <thead className="sticky top-0" style={{ background: isDark ? "#0b0b0f" : "#f9fafb" }}>
                        <tr>
                            {[
                                "Fecha",
                                "Factura",
                                "Ver",
                                "Tienda",
                                "Canal",
                                "Cliente",
                                "Categoría",
                                "Silueta",
                                "Tipo prenda",
                                "Talla",
                                "Print",
                                "Color",
                                "Cant.",
                                "Precio",
                                "Total",
                            ].map((h) => (
                                <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr
                                key={`${r.numero}-${i}`}
                                className="transition-colors"
                                style={{ borderTop: `1px solid ${borderColor}` }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                                <td className="px-3 py-1 whitespace-nowrap">{fmtDate(r.fecha_emision)}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.numero}</td>
                                <td className="px-3 py-1 whitespace-nowrap">
                                    {r.public_url ? (
                                        <a
                                            href={r.public_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Ver factura"
                                            className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs transition"
                                            style={{
                                                color: PRIMARY,
                                                borderColor: PRIMARY,
                                                backgroundColor: isDark ? "transparent" : "transparent"
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(3,166,136,.15)" : "rgba(3,166,136,.10)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                        >
                                            🧾 <span className="sr-only">Ver factura</span>
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.nombre_tienda ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.tipo_canal ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.id_cliente_final ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.categoria ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.silueta ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.tipo_prenda ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.talla ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.print ?? "-"}</td>
                                <td className="px-3 py-1 whitespace-nowrap">{r.color ?? "-"}</td>
                                <td className="px-3 py-1 text-right">{nfInt.format(r.cantidad ?? 0)}</td>
                                <td className="px-3 py-1 text-right">{nfCOP.format(r.precio_unitario ?? 0)}</td>
                                <td className="px-3 py-1 text-right">{nfCOP.format(r.total ?? 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: isDark ? "#0b0b0f" : "#f9fafb", borderTop: `1px solid ${borderColor}` }}>
                            <td className="px-3 py-2 font-medium" colSpan={12}>Totales</td>
                            <td className="px-3 py-2 text-right">{nfInt.format(rows.reduce((a, r) => a + Number(r.cantidad || 0), 0))}</td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-right">{nfCOP.format(rows.reduce((a, r) => a + Number(r.total || 0), 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Notas */}
            <div className="text-[11px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                <p>• Orden estable (<code>fecha_emision ASC</code>, <code>numero ASC</code>) aplicado antes de paginar.</p>
                <p>• Límite de rango: máximo {MAX_DAYS} días. Ajusta la constante si necesitas 1 año.</p>
                <p>• Fuente: <code>{DETAIL_VIEW}</code>. KPIs y serie salen del detalle → paridad con consolidado cuando usas el mismo rango y filtros.</p>
            </div>
        </div>
    );
}

function Kpi({ title, value, isDark }) {
    return (
        <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ border: `1px solid ${isDark ? BORDER_DARK : BORDER_LIGHT}`, backgroundColor: isDark ? "#0b0b0f" : "#ffffff" }}
        >
            <div className="text-xs uppercase tracking-wide" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                {title}
            </div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: isDark ? TEXT_DARK : TEXT_LIGHT }}>
                {value}
            </div>
        </div>
    );
}
