import React, { useEffect, useMemo, useState } from "react";
import { getSupabase } from '@/lib/supabaseClient';
import KroBiLoader from "@/components/KroBiLoader.jsx";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";

const supabase = getSupabase();
/**
 * Props:
 * - mobileLite?: boolean
 * - filtros: { anio: number, mes?: string("January".."December" | ""), categoria?: string[], talla?: string, silueta?: string, tipo_prenda?: string, print_o_color?: string[] }
 * - categoriaPorFactura?: boolean
 * - maxRows?: number
 * - chartHeight?: number
 * - disableExports?: boolean
 * - kpiCompact?: boolean
 */
export default function Consolidado({
    mobileLite = false,
    filtros = {},
    categoriaPorFactura = false,
    maxRows = 200,
    chartHeight = 340,
    disableExports = false,
    kpiCompact = false,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Tabla / KPIs / Serie
    const [datosConsolidado, setDatosConsolidado] = useState([]);
    const [serieMensual, setSerieMensual] = useState([]);

    const [kpiVentas, setKpiVentas] = useState(0);
    const [kpiUnidades, setKpiUnidades] = useState(0);
    const [kpiFacturas, setKpiFacturas] = useState(0);
    const [kpiClientes, setKpiClientes] = useState(0);

    const PAGE = 1000;
    const BASE_VIEW = categoriaPorFactura
        ? "v_consolidado_base_reconc_xcats"
        : "v_consolidado_base_reconc";
    const GENERAL_VIEW = "v_consolidado_general_reconc";

    // ===== Utils (copias locales para no depender del padre) =====
    const formatoCOP = (v) =>
        new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
        }).format(Number(v || 0));

    function buildPrintColorOr(selected) {
        if (!selected || selected.length === 0) return null;
        const parts = [];
        for (const raw of selected) {
            const v = String(raw).toLowerCase().trim();
            if (v === "sin print") {
                parts.push(`print.eq.sin print`);
                continue;
            }
            if (v === "sin color") {
                parts.push(`color.eq.sin color`);
                continue;
            }
            const safe = v.replace(/[(),]/g, " ");
            parts.push(`print.ilike.*${safe}*`);
            parts.push(`color.ilike.*${safe}*`);
        }
        return parts.join(",");
    }

    const mesesEs = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const mesesOrdenados = [
        { en: "January", es: "Enero" },
        { en: "February", es: "Febrero" },
        { en: "March", es: "Marzo" },
        { en: "April", es: "Abril" },
        { en: "May", es: "Mayo" },
        { en: "June", es: "Junio" },
        { en: "July", es: "Julio" },
        { en: "August", es: "Agosto" },
        { en: "September", es: "Septiembre" },
        { en: "October", es: "Octubre" },
        { en: "November", es: "Noviembre" },
        { en: "December", es: "Diciembre" },
    ];

    function densificarSerie(serie, mesSeleccionadoEn) {
        const byNum = new Map(serie.map((r) => [r.mes_num, r]));
        if (!mesSeleccionadoEn) {
            return Array.from({ length: 12 }, (_, i) => {
                const mnum = i + 1;
                const found = byNum.get(mnum);
                return found ?? { mes: mesesEs[i], mes_num: mnum, valor: 0 };
            });
        }
        const idxEn = mesesOrdenados.findIndex((m) => m.en === mesSeleccionadoEn);
        if (idxEn === -1) return serie;
        const wrap = (n) => ((n % 12) + 12) % 12;
        const idxs = [wrap(idxEn - 1), idxEn, wrap(idxEn + 1)];
        return idxs.map((i) => {
            const mnum = i + 1;
            const found = byNum.get(mnum);
            return found ?? { mes: mesesEs[i], mes_num: mnum, valor: 0 };
        });
    }

    // ====== Filtros comunes (mismo criterio que en Reportes.jsx) ======
    const { anio, mes, categoria = [], silueta, tipo_prenda, talla, print_o_color = [] } = filtros || {};
    const catsLower = Array.isArray(categoria)
        ? categoria.map((c) => String(c).toLowerCase())
        : [];

    const applyFilters = (q, isBase = false) => {
        if (mes) q = q.eq(isBase ? "mes_en" : "mes", mes);

        // Si NO es por factura, usar IN categoria
        if (!categoriaPorFactura && catsLower.length > 0) {
            const cats = catsLower.includes("ajuste") ? catsLower : [...catsLower, "ajuste"];
            q = q.in("categoria", cats);
        }

        if (silueta) q = q.eq("silueta", String(silueta).toLowerCase());
        if (tipo_prenda) q = q.eq("tipo_prenda", String(tipo_prenda).toLowerCase());
        if (talla) q = q.eq("talla", String(talla).toLowerCase());

        if (print_o_color?.length > 0) {
            const vals = print_o_color.map((v) => String(v).toLowerCase().trim());
            const onlySinColor = vals.length === 1 && vals[0] === "sin color";
            const onlySinPrint = vals.length === 1 && vals[0] === "sin print";
            if (onlySinColor) q = q.eq("color", "sin color");
            else if (onlySinPrint) q = q.eq("print", "sin print");
            else {
                const orStr = buildPrintColorOr(vals);
                if (orStr) q = q.or(orStr);
            }
        }
        return q;
    };

    const applyCategoryPerInvoice = (q, selectedCategorias) => {
        if (!categoriaPorFactura) return q;
        const cats = (selectedCategorias || []).map((c) => String(c).toLowerCase().trim());
        if (cats.length === 0) return q;
        return q.filter("cats_json", "cs", JSON.stringify(cats)); // JSON CONTAINS en Supabase
    };

    // ====== Fetch principal ======
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                // --- 1) Datos agregados para tabla ---
                if (!categoriaPorFactura) {
                    // MODO NORMAL: tomar la vista ya agregada
                    let q1 = supabase.from(GENERAL_VIEW).select("*").eq("anio", anio);
                    q1 = applyFilters(q1, false);
                    const { data: data1, error: err1 } = await q1;
                    if (err1) throw err1;
                    if (!cancelled) setDatosConsolidado(data1 || []);
                } else {
                    // MODO POR FACTURA: traer base, filtrar cats_json y agregar en cliente
                    let pageB = 0;
                    const rowsBase = [];
                    while (true) {
                        let qb = supabase
                            .from(BASE_VIEW)
                            .select(
                                "anio,mes_en,mes_num,categoria,talla,tipo_prenda,silueta,print,color,total,cantidad,numero,id_cliente_final"
                            )
                            .eq("anio", anio)
                            .range(pageB * PAGE, pageB * PAGE + PAGE - 1);

                        qb = applyFilters(qb, true);
                        qb = applyCategoryPerInvoice(qb, categoria);

                        const { data: db, error: ebase } = await qb;
                        if (ebase) throw ebase;

                        const chunk = db || [];
                        rowsBase.push(...chunk);
                        if (chunk.length < PAGE) break;
                        pageB += 1;
                        if (pageB > 2000) break;
                    }

                    const keyOf = (r) =>
                        [r.anio, r.mes_en, r.categoria, r.talla, r.tipo_prenda, r.silueta, r.print, r.color].join("||");

                    const map = new Map();
                    for (const r of rowsBase) {
                        const k = keyOf(r);
                        if (!map.has(k)) {
                            map.set(k, {
                                anio: r.anio,
                                mes: r.mes_en,
                                mes_num: r.mes_num,
                                categoria: r.categoria,
                                talla: r.talla,
                                tipo_prenda: r.tipo_prenda,
                                silueta: r.silueta,
                                print: r.print,
                                color: r.color,
                                total_unidades: 0,
                                total_ventas: 0,
                                facturas: new Set(),
                                clientes: new Set(),
                            });
                        }
                        const agg = map.get(k);
                        agg.total_unidades += Number(r.cantidad || 0);
                        agg.total_ventas += Number(r.total || 0);
                        if (r.numero) agg.facturas.add(r.numero);
                        if (r.id_cliente_final) agg.clientes.add(r.id_cliente_final);
                    }

                    const agregada = Array.from(map.values()).map((v) => ({
                        anio: v.anio,
                        mes: v.mes,
                        mes_num: v.mes_num,
                        categoria: v.categoria,
                        talla: v.talla,
                        tipo_prenda: v.tipo_prenda,
                        silueta: v.silueta,
                        print: v.print,
                        color: v.color,
                        total_unidades: v.total_unidades,
                        total_ventas: v.total_ventas,
                        total_facturas: v.facturas.size,
                        total_clientes: v.clientes.size,
                    }))
                        .sort((a, b) =>
                            b.anio - a.anio ||
                            a.mes_num - b.mes_num ||
                            a.categoria.localeCompare(b.categoria || "") ||
                            (a.talla || "").localeCompare(b.talla || "")
                        );

                    if (!cancelled) setDatosConsolidado(agregada);
                }

                // --- 2) KPIs (suma/contador) con BASE_VIEW paginada ---
                let page = 0,
                    totalVentas = 0,
                    totalUnidades = 0;

                while (true) {
                    let qSum = supabase
                        .from(BASE_VIEW)
                        .select("total,cantidad")
                        .eq("anio", anio)
                        .range(page * PAGE, page * PAGE + PAGE - 1);

                    qSum = applyFilters(qSum, true);
                    qSum = applyCategoryPerInvoice(qSum, categoria);

                    const { data, error } = await qSum;
                    if (error) throw error;

                    const rows = data || [];
                    totalVentas += rows.reduce((a, r) => a + Number(r.total || 0), 0);
                    totalUnidades += rows.reduce((a, r) => a + Number(r.cantidad || 0), 0);

                    if (rows.length < PAGE) break;
                    page += 1;
                    if (page > 2000) break;
                }

                let qFact = supabase
                    .from(BASE_VIEW)
                    .select("numero", { count: "exact", head: true })
                    .eq("anio", anio);
                qFact = applyFilters(qFact, true);
                qFact = applyCategoryPerInvoice(qFact, categoria);
                const { count: factCount, error: factErr } = await qFact;
                if (factErr) throw factErr;

                let qCli = supabase
                    .from(BASE_VIEW)
                    .select("id_cliente_final", { count: "exact", head: true })
                    .eq("anio", anio);
                qCli = applyFilters(qCli, true);
                qCli = applyCategoryPerInvoice(qCli, categoria);
                const { count: cliCount, error: cliErr } = await qCli;
                if (cliErr) throw cliErr;

                if (!cancelled) {
                    setKpiVentas(totalVentas);
                    setKpiUnidades(totalUnidades);
                    setKpiFacturas(factCount ?? 0);
                    setKpiClientes(cliCount ?? 0);
                }

                // --- 3) Serie mensual desde BASE_VIEW (sum por mes) ---
                let pageM = 0;
                const acc = new Map(); // mes_num -> { mes_num, mes_es, total }
                while (true) {
                    let qMonth = supabase
                        .from(BASE_VIEW)
                        .select("mes_num,mes_es,total")
                        .eq("anio", anio)
                        .range(pageM * PAGE, pageM * PAGE + PAGE - 1);

                    qMonth = applyFilters(qMonth, true);
                    qMonth = applyCategoryPerInvoice(qMonth, categoria);

                    const { data: mdata, error: merr } = await qMonth;
                    if (merr) throw merr;

                    const rows = mdata || [];
                    for (const r of rows) {
                        const key = Number(r?.mes_num ?? NaN);
                        if (!Number.isFinite(key)) continue;
                        const prev = acc.get(key) || { mes_num: key, mes_es: r.mes_es, total: 0 };
                        prev.mes_es = r.mes_es || prev.mes_es;
                        prev.total += Number(r.total || 0);
                        acc.set(key, prev);
                    }

                    if (rows.length < PAGE) break;
                    pageM += 1;
                    if (pageM > 2000) break;
                }

                const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
                const serie = [...acc.values()]
                    .sort((a, b) => a.mes_num - b.mes_num)
                    .map((r) => ({ mes: cap(r.mes_es), mes_num: r.mes_num, valor: r.total }));

                if (!cancelled) {
                    setSerieMensual(densificarSerie(serie, mes));
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e?.message || "Error desconocido");
                    setDatosConsolidado([]);
                    setSerieMensual([]);
                    setKpiVentas(0);
                    setKpiUnidades(0);
                    setKpiFacturas(0);
                    setKpiClientes(0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        if (anio) run();
        return () => { cancelled = true; };
    }, [anio, mes, JSON.stringify(categoria), silueta, tipo_prenda, talla, JSON.stringify(print_o_color), categoriaPorFactura]);

    // ===== Derivados para UI =====
    const dataTabla = useMemo(() => {
        const base = datosConsolidado || [];
        return mobileLite ? base.slice(0, maxRows) : base;
    }, [datosConsolidado, mobileLite, maxRows]);

    const kpiClass = kpiCompact ? "text-sm" : "text-base";

    // ===== Render =====
    if (loading) {
        return (
            <KroBiLoader
                message="Cargando magia de KroBi…"
                subtext="Consultando Supabase y afinando filtros"
            />
        );
    }

    if (error) {
        return (
            <div className="text-center text-sm text-red-600 dark:text-red-400 border border-dashed rounded-xl p-6">
                Error: {String(error)}
            </div>
        );
    }

    if (!dataTabla.length) {
        return (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed rounded-xl p-6">
                No hay resultados para los filtros seleccionados.
            </div>
        );
    }


    const kpiGridClass = mobileLite
        ? `grid grid-cols-1 gap-4 ${kpiClass}`
        : `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${kpiClass}`;

    // 🔹 MODO MÓVIL LIGERO: solo KPIs, sin gráfica ni tabla
    if (mobileLite) {
        return (
            <div className="space-y-4 max-w-full">
                <div className={kpiGridClass}>
                    <KpiCard title="Ventas Totales" value={formatoCOP(kpiVentas)} />
                    <KpiCard title="Unidades Vendidas" value={kpiUnidades.toLocaleString()} />
                    <KpiCard title="Facturas Emitidas" value={kpiFacturas.toLocaleString()} />
                    <KpiCard title="Clientes Únicos" value={kpiClientes.toLocaleString()} />
                </div>
            </div>
        );
    }

    // return (
    //     <div className="space-y-6">
    //         {/* KPIs */}
    //         {!disableExports && (
    //             <div className="flex items-center justify-end gap-2 mb-1">
    //                 {/* Si luego quieres pasar handlers de exportación por props, los montas aquí */}
    //             </div>
    //         )}

    //         <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${kpiClass}`}>
    //             <KpiCard title="Ventas Totales" value={formatoCOP(kpiVentas)} />
    //             <KpiCard title="Unidades Vendidas" value={kpiUnidades.toLocaleString()} />
    //             <KpiCard title="Facturas Emitidas" value={kpiFacturas.toLocaleString()} />
    //             <KpiCard title="Clientes Únicos" value={kpiClientes.toLocaleString()} />
    //         </div>

    //         {/* Serie mensual */}
    //         <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
    //             <ResponsiveContainer width="100%" height={chartHeight}>
    //                 <LineChart data={serieMensual} margin={{ top: 16, right: 24, left: 24, bottom: 8 }}>
    //                     <CartesianGrid strokeDasharray="3 3" />
    //                     <XAxis dataKey="mes" />
    //                     <YAxis tickFormatter={(v) => formatoCOP(v)} />
    //                     <Tooltip formatter={(v) => formatoCOP(v)} />
    //                     <Line type="monotone" dataKey="valor" stroke="#03A688" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
    //                 </LineChart>
    //             </ResponsiveContainer>
    //         </div>

    //         {/* Tabla simple (recortada en mobileLite) */}
    //         <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm overflow-auto max-h-[70svh]">
    //             <table className="w-full text-sm">
    //                 <thead className="text-left text-gray-600 dark:text-gray-300">
    //                     <tr>
    //                         <th className="py-2 pr-4">Año</th>
    //                         <th className="py-2 pr-4">Mes</th>
    //                         <th className="py-2 pr-4">Categoría</th>
    //                         <th className="py-2 pr-4">Talla</th>
    //                         <th className="py-2 pr-4">Tipo prenda</th>
    //                         <th className="py-2 pr-4">Silueta</th>
    //                         <th className="py-2 pr-4">Print</th>
    //                         <th className="py-2 pr-4">Color</th>
    //                         <th className="py-2 pr-4 text-right">Unidades</th>
    //                         <th className="py-2 pr-4 text-right">Ventas</th>
    //                     </tr>
    //                 </thead>
    //                 <tbody className="text-gray-800 dark:text-gray-100">
    //                     {dataTabla.map((r, i) => (
    //                         <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
    //                             <td className="py-2 pr-4">{r.anio ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.mes ?? r.mes_es ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.categoria ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.talla ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.tipo_prenda ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.silueta ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.print ?? ""}</td>
    //                             <td className="py-2 pr-4">{r.color ?? ""}</td>
    //                             <td className="py-2 pr-4 text-right">{Number(r.total_unidades ?? r.cantidad ?? 0).toLocaleString()}</td>
    //                             <td className="py-2 pr-4 text-right">{formatoCOP(r.total_ventas ?? r.total ?? 0)}</td>
    //                         </tr>
    //                     ))}
    //                 </tbody>
    //             </table>
    //             {mobileLite && datosConsolidado.length > maxRows && (
    //                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
    //                     Mostrando {maxRows.toLocaleString()} de {datosConsolidado.length.toLocaleString()} filas (vista móvil).
    //                 </p>
    //             )}
    //         </div>
    //     </div>
    // );

    // 🔹 MODO NORMAL (desktop): KPIs + grafica + tabla
    return (
        <div className="space-y-6">
            {!disableExports && (
                <div className="flex items-center justify-end gap-2 mb-1">
                    {/* Si luego quieres pasar handlers de exportación por props, los montas aquí */}
                </div>
            )}

            <div className={kpiGridClass}>
                <KpiCard title="Ventas Totales" value={formatoCOP(kpiVentas)} />
                <KpiCard title="Unidades Vendidas" value={kpiUnidades.toLocaleString()} />
                <KpiCard title="Facturas Emitidas" value={kpiFacturas.toLocaleString()} />
                <KpiCard title="Clientes Únicos" value={kpiClientes.toLocaleString()} />
            </div>

            {/* Serie mensual */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <LineChart
                        data={serieMensual}
                        margin={{ top: 16, right: 24, left: 24, bottom: 8 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={(v) => formatoCOP(v)} />
                        <Tooltip formatter={(v) => formatoCOP(v)} />
                        <Line
                            type="monotone"
                            dataKey="valor"
                            stroke="#03A688"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Tabla simple (recortada en mobileLite) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm overflow-auto max-h-[70svh]">
                <table className="w-full text-sm">
                    <thead className="text-left text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="py-2 pr-4">Año</th>
                            <th className="py-2 pr-4">Mes</th>
                            <th className="py-2 pr-4">Categoría</th>
                            <th className="py-2 pr-4">Talla</th>
                            <th className="py-2 pr-4">Tipo prenda</th>
                            <th className="py-2 pr-4">Silueta</th>
                            <th className="py-2 pr-4">Print</th>
                            <th className="py-2 pr-4">Color</th>
                            <th className="py-2 pr-4 text-right">Unidades</th>
                            <th className="py-2 pr-4 text-right">Ventas</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-100">
                        {dataTabla.map((r, i) => (
                            <tr
                                key={i}
                                className="border-t border-gray-100 dark:border-gray-800"
                            >
                                <td className="py-2 pr-4">{r.anio ?? ""}</td>
                                <td className="py-2 pr-4">
                                    {r.mes ?? r.mes_es ?? ""}
                                </td>
                                <td className="py-2 pr-4">{r.categoria ?? ""}</td>
                                <td className="py-2 pr-4">{r.talla ?? ""}</td>
                                <td className="py-2 pr-4">
                                    {r.tipo_prenda ?? ""}
                                </td>
                                <td className="py-2 pr-4">{r.silueta ?? ""}</td>
                                <td className="py-2 pr-4">{r.print ?? ""}</td>
                                <td className="py-2 pr-4">{r.color ?? ""}</td>
                                <td className="py-2 pr-4 text-right">
                                    {Number(
                                        r.total_unidades ?? r.cantidad ?? 0
                                    ).toLocaleString()}
                                </td>
                                <td className="py-2 pr-4 text-right">
                                    {formatoCOP(r.total_ventas ?? r.total ?? 0)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {mobileLite && datosConsolidado.length > maxRows && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Mostrando {maxRows.toLocaleString()} de{" "}
                        {datosConsolidado.length.toLocaleString()} filas (vista
                        móvil).
                    </p>
                )}
            </div>
        </div>
    );
}

function KpiCard({ title, value }) {
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
            <p className="text-xl font-bold text-krobi">{value}</p>
        </div>
    );
}
