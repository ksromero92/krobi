import React, { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom"
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    LineChart, Line, ResponsiveContainer
} from "recharts";
import { getSupabase } from '@/lib/supabaseClient';
import KroBiLoader from "../components/KroBiLoader";
import KroBiNoData from "../components/KroBiNoData";
import KroBiNoNetwork from "../components/KroBiNoNetwork";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import Select from "react-select";


const VentasDetalle = lazy(() => import("../Reportes/VentasDetalle"));
const Inventarios = lazy(() => import("../Reportes/Inventarios"));
const VentasPorCanal = lazy(() => import("../Reportes/VentasPorCanal"));
const VentasPorTienda = lazy(() => import("../Reportes/VentasPorTienda"));
const VentasPorVendedor = lazy(() => import("../Reportes/VentasPorVendedor"));


const supabase = getSupabase();
export default function Reportes() {
    // const [tipoReporte, setTipoReporte] = useState("consolidado"); estado actual del reporte

    // Persistencia silenciosa del reporte seleccionado (URL + localStorage)
    const [params, setParams] = useSearchParams();
    const { pathname } = useLocation(); // por si luego quieres llaves por ruta
    const LS_KEY_REPORT = "krobi:/reportes:r";
    const online = useNetworkStatus();
    const currentYear = new Date().getFullYear(); // 2026

    const getInitialReport = () => {
        // 1) URL (r), 2) localStorage, 3) 'consolidado'
        const r = params.get("r");
        if (r) return r;
        try {
            const ls = localStorage.getItem(LS_KEY_REPORT);
            if (ls) return ls;
        } catch { }
        return "consolidado";
    };


    const [tipoReporte, setTipoReporte] = useState(getInitialReport());
    const [netError, setNetError] = useState(false);


    const [datosConsolidado, setDatosConsolidado] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ==== FILTROS ====
    const [filtros, setFiltros] = useState({
        anio: currentYear,
        mes: "",
        categoria: [],
        talla: "",
        coleccion: "",
        silueta: "",
        tipo_prenda: "",
        tienda: [],
        print_o_color: [],
        canal: ""
    });

    const [vendedoresFiltros, setVendedoresFiltros] = useState({
        anio: currentYear,
        mes: "",
        tienda: "",
        canal: ""
    });

    // ==== CATÁLOGOS ====
    const [añosDisponibles, setAñosDisponibles] = useState([]);
    const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
    const [tallasDisponibles, setTallasDisponibles] = useState([]);
    const [coleccionesDisponibles, setColeccionesDisponibles] = useState([]);
    const [mesesDisponibles, setMesesDisponibles] = useState([]);
    const [siluetasDisponibles, setSiluetasDisponibles] = useState([]);
    const [tiposPrendaDisponibles, setTiposPrendaDisponibles] = useState([]);
    const [printsYColoresDisponibles, setPrintsYColoresDisponibles] = useState([]);
    const [tiendasDisponibles, setTiendasDisponibles] = useState([]);
    const [canalesDisponibles, setCanalesDisponibles] = useState([]);
    const [categoriaPorFactura, setCategoriaPorFactura] = useState(false);

    // ==== (KPIs + serie) ===
    const [kpiVentas, setKpiVentas] = useState(0);
    const [kpiUnidades, setKpiUnidades] = useState(0);
    const [kpiFacturas, setKpiFacturas] = useState(0);
    const [kpiClientes, setKpiClientes] = useState(0);
    const [serieMensual, setSerieMensual] = useState([]); // [{ mes, valor }]


    // ==== DATOS TIENDA / VENDEDOR ====
    const [datosTienda, setDatosTienda] = useState([]);
    const [ventasPorCanal, setVentasPorCanal] = useState({});
    const [datosVendedor, setDatosVendedor] = useState([]);
    const [datosCanal, setDatosCanal] = useState([]);

    const INIT_FILTROS = {
        anio: currentYear,
        mes: "",
        categoria: [],
        silueta: "",
        tipo_prenda: "",
        print_o_color: [],
        coleccion: "",
        talla: "",
        tienda: [],
        canal: "",
    };

    const MESES_ORDEN_LOGICO = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];

    const MAPA_MESES = {
        January: "Enero",
        February: "Febrero",
        March: "Marzo",
        April: "Abril",
        May: "Mayo",
        June: "Junio",
        July: "Julio",
        August: "Agosto",
        September: "Septiembre",
        October: "Octubre",
        November: "Noviembre",
        December: "Diciembre",
    };

    const mesesDisponiblesVendedor = useMemo(() => {
        const mesesEnData = Array.from(
            new Set(
                (datosVendedor || [])
                    .map(r => (r.mes_en || "").trim())
                    .filter(Boolean)
            )
        );

        // Opcional: debug
        console.log("Meses presentes en datosVendedor:", mesesEnData.join(", "));

        return MESES_ORDEN_LOGICO
            .filter(m => mesesEnData.includes(m))
            .map(m => ({ en: m, es: MAPA_MESES[m] }));
    }, [datosVendedor]);

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

    const handleFiltro = (e) => {
        const { name, value } = e.target;
        setFiltros({ ...filtros, [name]: name === "anio" ? Number(value) : value });
    };

    const handleFiltroVendedor = (e) => {
        const { name, value } = e.target;
        setVendedoresFiltros({
            ...vendedoresFiltros,
            [name]: name === "anio" ? Number(value) : value
        });
    };

    const formatoCOP = (valor) =>
        new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);

    const formatoUnidades = (valor) => Number(valor ?? 0).toLocaleString();


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
        { en: "December", es: "Diciembre" }
    ];


    const mesesEs = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    function densificarSerie(serie, mesSeleccionadoEn /* ej: 'January' o '' */) {
        const byNum = new Map(serie.map(r => [r.mes_num, r]));
        // si NO hay filtro de mes: devuelve los 12 meses (0 si falta)
        if (!mesSeleccionadoEn) {
            // return Array.from({ length: 12 }, (_, i) => {
            //     const mnum = i + 1;
            //     const found = byNum.get(mnum);
            //     return found ?? { mes: mesesEs[i], mes_num: mnum, valor: 0 };
            // });
            return Array.from({ length: 12 }, (_, i) => {
                const mnum = i + 1;
                const found = byNum.get(mnum);
                return found ?? { mes: mesesEs[i], mes_num: mnum, unidades: 0 };
            });
        }

        // si HAY filtro de mes: muestra mes anterior, actual y siguiente (con 0 si faltan)
        const idxEn = mesesOrdenados.findIndex(m => m.en === mesSeleccionadoEn);
        if (idxEn === -1) return serie; // fallback
        const wrap = (n) => ((n % 12) + 12) % 12; // manejo circular
        const idxs = [wrap(idxEn - 1), idxEn, wrap(idxEn + 1)];
        // return idxs.map(i => {
        //     const mnum = i + 1;
        //     const found = byNum.get(mnum);
        //     return found ?? { mes: mesesEs[i], mes_num: mnum, valor: 0 };
        // });
        return idxs.map(i => {
            const mnum = i + 1;
            const found = byNum.get(mnum);
            return found ?? { mes: mesesEs[i], mes_num: mnum, unidades: 0 };
        });
    }

    const ordenarTallas = (tallas) => {
        const especiales = ["única", "unica", "tu"];
        const alfabéticas = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl"];

        return tallas
            .filter(Boolean)
            .map((t) => t.toLowerCase())
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => {
                const numA = parseInt(a);
                const numB = parseInt(b);
                const esNumA = !isNaN(numA);
                const esNumB = !isNaN(numB);
                if (esNumA && esNumB) return numA - numB;
                if (esNumA) return -1;
                if (esNumB) return 1;
                const idxA = alfabéticas.indexOf(a);
                const idxB = alfabéticas.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                if (especiales.includes(a) && especiales.includes(b)) return 0;
                if (especiales.includes(a)) return 1;
                if (especiales.includes(b)) return -1;
                return a.localeCompare(b);
            });
    };

    const isNetworkError = (e) =>
        !navigator.onLine ||
        e?.name === "TypeError" ||
        String(e?.message || "").includes("Failed to fetch") ||
        e?.status === 0; // fetch abortado / sin respuesta

    const handleRetry = () => {
        setNetError(false);
        fetchConsolidado(); // usa el mismo método que ya tenías para cargar datos
    };
    // ================== FETCH CONSOLIDADO ==================
    useEffect(() => {
        if (tipoReporte !== "consolidado") return;
        const fetchConsolidado = async () => {
            setLoading(true);
            setNetError(false);
            setError(null);

            // === Helpers ===
            const applyFilters = (q, isBase = false) => {
                if (filtros.mes) q = q.eq(isBase ? "mes_en" : "mes", filtros.mes);

                // NO mezclar lógicas: si filtramos por factura, NO usar in('categoria', ...)
                if (!categoriaPorFactura && filtros.categoria.length > 0) {
                    const cats = filtros.categoria.map((c) => c.toLowerCase());
                    if (!cats.includes("ajuste")) cats.push("ajuste");
                    q = q.in("categoria", cats);
                }

                if (filtros.silueta) q = q.eq("silueta", filtros.silueta.toLowerCase());
                if (filtros.tipo_prenda) q = q.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
                if (filtros.talla) q = q.eq("talla", filtros.talla.toLowerCase());
                if (filtros.coleccion) q = q.eq("coleccion", String(filtros.coleccion).toLowerCase().trim());
                if (filtros.print_o_color?.length > 0) {
                    const vals = filtros.print_o_color.map((v) => v.toLowerCase().trim());
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

            // Filtro por factura (superset: la factura contiene TODAS las seleccionadas)
            const applyCategoryPerInvoice = (q, selectedCategorias) => {
                if (!selectedCategorias || selectedCategorias.length === 0) return q;
                const cats = selectedCategorias.map((c) => String(c).toLowerCase().trim());
                // Forzamos JSON válido en la query: ["niña","niño"]
                return q.filter('cats_json', 'cs', JSON.stringify(cats));
            };


            try {
                const PAGE = 1000;
                const BASE_VIEW = categoriaPorFactura
                    ? "v_consolidado_base_reconc_xcats"
                    : "v_consolidado_base_reconc";
                const GENERAL_VIEW = "v_consolidado_general_reconc"; // en modo por factura agregamos en cliente

                // --- 1) Tabla / gráfica principal ---
                if (!categoriaPorFactura) {
                    // MODO NORMAL: vista agregada directa
                    let q1 = supabase.from(GENERAL_VIEW).select("*").eq("anio", filtros.anio);
                    q1 = applyFilters(q1, false);
                    const { data: data1, error: err1 } = await q1;
                    if (err1) throw new Error(err1.message);
                    setDatosConsolidado(data1 || []);
                } else {
                    // MODO POR FACTURA: traer base (con cats_json), filtrar cats y agregar en cliente
                    let pageB = 0;
                    const rowsBase = [];

                    while (true) {
                        let qb = supabase
                            .from(BASE_VIEW)
                            .select("anio,mes_en,mes_num,categoria,talla,tipo_prenda,silueta,print,color,total,cantidad,numero,id_cliente_final")
                            .eq("anio", filtros.anio)
                            .range(pageB * PAGE, pageB * PAGE + PAGE - 1);

                        qb = applyFilters(qb, true);
                        qb = applyCategoryPerInvoice(qb, filtros.categoria); // <- cats_json @> ["...","..."]

                        const { data: db, error: ebase } = await qb;
                        if (ebase) throw ebase;

                        const chunk = db || [];
                        rowsBase.push(...chunk);
                        if (chunk.length < PAGE) break;
                        pageB += 1;
                        if (pageB > 2000) break;
                    }

                    // Agregación en cliente (mismo shape que v_consolidado_general_reconc)
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

                    const data1 = Array.from(map.values()).map((v) => ({
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
                            a.categoria.localeCompare(b.categoria) ||
                            a.talla.localeCompare(b.talla)
                        );

                    setDatosConsolidado(data1);
                }

                // --- 2) KPIs (SUM/COUNT) desde BASE_VIEW, con paginación ---
                let page = 0, totalVentas = 0, totalUnidades = 0;
                while (true) {
                    let qSumPage = supabase
                        .from(BASE_VIEW)
                        .select("total,cantidad")
                        .eq("anio", filtros.anio)
                        .range(page * PAGE, page * PAGE + PAGE - 1);

                    qSumPage = applyFilters(qSumPage, true);
                    if (categoriaPorFactura && filtros.categoria.length > 0) {
                        qSumPage = applyCategoryPerInvoice(qSumPage, filtros.categoria);
                    }

                    const { data, error } = await qSumPage;
                    if (error) throw error;

                    const rows = data || [];
                    totalVentas += rows.reduce((a, r) => a + Number(r.total || 0), 0);
                    totalUnidades += rows.reduce((a, r) => a + Number(r.cantidad || 0), 0);

                    if (rows.length < PAGE) break;
                    page += 1;
                    if (page > 2000) break;
                }

                // COUNT DISTINCT facturas
                // DISTINCT facturas (cliente, con Set)
                let pageF = 0;
                const facturasSet = new Set();
                while (true) {
                    let qF = supabase
                        .from(BASE_VIEW)
                        .select("numero")
                        .eq("anio", filtros.anio)
                        .range(pageF * PAGE, pageF * PAGE + PAGE - 1);

                    qF = applyFilters(qF, true);
                    if (categoriaPorFactura && filtros.categoria.length > 0) {
                        qF = applyCategoryPerInvoice(qF, filtros.categoria);
                    }

                    const { data: fdata, error: ferr } = await qF;
                    if (ferr) throw ferr;

                    (fdata || []).forEach(r => { if (r?.numero) facturasSet.add(r.numero); });

                    if (!fdata || fdata.length < PAGE) break;
                    pageF += 1;
                    if (pageF > 2000) break;
                }
                const facturasCount = facturasSet.size;


                // COUNT DISTINCT clientes
                // DISTINCT clientes (cliente, con Set)
                let pageC = 0;
                const clientesSet = new Set();
                while (true) {
                    let qC = supabase
                        .from(BASE_VIEW)
                        .select("id_cliente_final")
                        .eq("anio", filtros.anio)
                        .range(pageC * PAGE, pageC * PAGE + PAGE - 1);

                    qC = applyFilters(qC, true);
                    if (categoriaPorFactura && filtros.categoria.length > 0) {
                        qC = applyCategoryPerInvoice(qC, filtros.categoria);
                    }

                    const { data: cdata, error: cerr } = await qC;
                    if (cerr) throw cerr;

                    (cdata || []).forEach(r => { if (r?.id_cliente_final) clientesSet.add(r.id_cliente_final); });

                    if (!cdata || cdata.length < PAGE) break;
                    pageC += 1;
                    if (pageC > 2000) break;
                }
                const clientesCount = clientesSet.size;


                setKpiVentas(totalVentas);
                setKpiUnidades(totalUnidades);
                setKpiFacturas(facturasCount ?? 0);
                setKpiClientes(clientesCount ?? 0);

                // --- 3) Serie mensual (desde BASE_VIEW) ---
                // let pageM = 0;
                // const acc = new Map(); // mes_num -> { mes_num, mes_es, total }
                // while (true) {
                //     let qMonth = supabase
                //         .from(BASE_VIEW)
                //         .select("mes_num,mes_es,total")
                //         .eq("anio", filtros.anio)
                //         .range(pageM * PAGE, pageM * PAGE + PAGE - 1);

                //     qMonth = applyFilters(qMonth, true);
                //     if (categoriaPorFactura && filtros.categoria.length > 0) {
                //         qMonth = applyCategoryPerInvoice(qMonth, filtros.categoria);
                //     }

                //     const { data: mdata, error: merr } = await qMonth;
                //     if (merr) throw merr;

                //     const rows = mdata || [];
                //     for (const r of rows) {
                //         const key = Number(r?.mes_num ?? NaN);
                //         if (!Number.isFinite(key)) continue;
                //         const prev = acc.get(key) || { mes_num: key, mes_es: r.mes_es, total: 0 };
                //         prev.mes_es = r.mes_es || prev.mes_es;
                //         prev.total += Number(r.total || 0);
                //         acc.set(key, prev);
                //     }

                //     if (rows.length < PAGE) break;
                //     pageM += 1;
                //     if (pageM > 2000) break;
                // }

                // const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
                // const serie = [...acc.values()]
                //     .sort((a, b) => a.mes_num - b.mes_num)
                //     .map((r) => ({ mes: cap(r.mes_es), mes_num: r.mes_num, valor: r.total }));

                // // 👇 en vez de setSerieMensual(serie) directo:
                // setSerieMensual(densificarSerie(serie, filtros.mes));


                let pageM = 0;
                const acc = new Map(); // mes_num -> { mes_num, mes_es, cantidad }
                while (true) {
                    let qMonth = supabase
                        .from(BASE_VIEW)
                        .select("mes_num,mes_es,cantidad")             // 👈 cambia total → cantidad
                        .eq("anio", filtros.anio)
                        .range(pageM * PAGE, pageM * PAGE + PAGE - 1);

                    qMonth = applyFilters(qMonth, true);
                    if (categoriaPorFactura && filtros.categoria.length > 0) {
                        qMonth = applyCategoryPerInvoice(qMonth, filtros.categoria);
                    }

                    const { data: mdata, error: merr } = await qMonth;
                    if (merr) throw merr;

                    const rows = mdata || [];
                    for (const r of rows) {
                        const key = Number(r?.mes_num ?? NaN);
                        if (!Number.isFinite(key)) continue;
                        const prev = acc.get(key) || { mes_num: key, mes_es: r.mes_es, cantidad: 0 };
                        prev.mes_es = r.mes_es || prev.mes_es;
                        prev.cantidad += Number(r.cantidad || 0);      // 👈 acumula unidades
                        acc.set(key, prev);
                    }

                    if (rows.length < PAGE) break;
                    pageM += 1;
                    if (pageM > 2000) break;
                }

                const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
                const serie = [...acc.values()]
                    .sort((a, b) => a.mes_num - b.mes_num)
                    .map((r) => ({ mes: cap(r.mes_es), mes_num: r.mes_num, unidades: r.cantidad }));  // 👈 valor = unidades

                setSerieMensual(densificarSerie(serie, filtros.mes));



            } catch (e) {
                if (isNetworkError(e)) {
                    setNetError(true);
                    return; // cortamos aquí, no es un error funcional de filtros
                }
                setError(e.message);
                setDatosConsolidado([]);
                setKpiVentas(0);
                setKpiUnidades(0);
                setKpiFacturas(0);
                setKpiClientes(0);
                setSerieMensual([]);

            } finally {
                setLoading(false);
            }
        };

        fetchConsolidado();
    }, [tipoReporte, filtros, categoriaPorFactura]);


    // ================== FETCH TIENDA ==================
    useEffect(() => {
        const fetchPorTienda = async () => {
            if (tipoReporte !== "tienda") return;

            setLoading(true);
            setError(null);

            // builder base sin filtro por tienda (y con ORDEN una sola vez)
            const buildBase = () => {
                let q = supabase
                    .from("v_ventas_por_tienda")
                    .select("anio,mes_num,mes_en,nombre_tienda,tipo_canal,categoria,talla,silueta,tipo_prenda,print,color,cats,total,cantidad,facturas,clientes_unicos")
                    .eq("anio", Number(filtros.anio))
                    .order("anio", { ascending: true })
                    .order("mes_num", { ascending: true })
                    .order("nombre_tienda", { ascending: true })
                    .order("tipo_canal", { ascending: true });

                if (filtros.mes) q = q.eq("mes_en", filtros.mes);
                if (!categoriaPorFactura && filtros.categoria?.length > 0) {
                    q = q.in("categoria", filtros.categoria.map(c => c.toLowerCase()));
                }
                if (filtros.silueta) q = q.eq("silueta", filtros.silueta.toLowerCase());
                if (filtros.tipo_prenda) q = q.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
                if (filtros.talla) q = q.eq("talla", filtros.talla.toLowerCase());
                if (filtros.coleccion) q = q.eq("coleccion", filtros.coleccion.toLowerCase());
                if (filtros.print_o_color?.length > 0) {
                    const orStr = buildPrintColorOr(filtros.print_o_color);
                    if (orStr) q = q.or(orStr);
                }
                if (categoriaPorFactura && filtros.categoria.length > 0) {
                    // const cats = filtros.categoria.map((c) => String(c).toLowerCase().trim());
                    // q = q.contains("cats", cats);


                    const cats = filtros.categoria.map((c) => String(c).toLowerCase().trim());
                    return q.filter('cats_json', 'cs', JSON.stringify(cats));
                    // q = q.filter("cats", "cs", JSON.stringify(filtros.categoria.map(c => c.toLowerCase())));
                }
                return q;
            };

            try {
                // 1) Traemos TODAS las tiendas según los otros filtros (año, mes, categoría, etc.)
                const data = await fetchAll(buildBase, 1000);

                // 2) Guardamos la data cruda de Supabase
                setDatosTienda(data || []);

                // 3) KPI por canal (se queda igual)
                const porCanal = (data || []).reduce((acc, curr) => {
                    const key = normalizeCanal(curr?.tipo_canal || "Sin canal");
                    acc[key] = (acc[key] || 0) + Number(curr.total || 0);
                    return acc;
                }, {});
                setVentasPorCanal(porCanal);
            } catch (err) {
                setError(err?.message || "Error");
                setDatosTienda([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPorTienda();
    }, [tipoReporte, filtros, categoriaPorFactura]);


    // ================== FETCH CANAL ==================
    useEffect(() => {
        if (tipoReporte !== "canal") return;
        const fetchPorCanal = async () => {
            if (tipoReporte !== "canal") return;

            setLoading(true);
            setError(null);

            try {
                let query = supabase
                    .from("v_ventas_por_canal")
                    .select("tipo_canal,total,cantidad,anio,mes_en,categoria,talla,silueta,tipo_prenda,coleccion,print,color,cats_json")
                    // .from("v_ventas_por_canal")
                    // .select(
                    //     "anio,mes_num,mes_en,tipo_canal,categoria,talla,silueta,tipo_prenda,print,color,cats,total,cantidad,facturas,clientes_unicos"
                    // ) // evita traer columnas innecesarias
                    .eq("anio", filtros.anio);

                // if (filtros.mes) query = query.eq("mes_en", filtros.mes);
                // if (filtros.canal) query = query.eq("tipo_canal", filtros.canal);
                // if (filtros.categoria?.length > 0) query = query.in("categoria", filtros.categoria.map(c => c.toLowerCase()));
                // if (filtros.silueta) query = query.eq("silueta", filtros.silueta.toLowerCase());
                // if (filtros.tipo_prenda) query = query.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
                // if (filtros.talla) query = query.eq("talla", filtros.talla.toLowerCase());
                // if (filtros.coleccion) query = query.eq("coleccion", filtros.coleccion.toLowerCase());
                // if (filtros.print_o_color?.length > 0) {
                //     const orStr = buildPrintColorOr(filtros.print_o_color);
                //     if (orStr) query = query.or(orStr);
                // }

                // if (categoriaPorFactura && filtros.categoria.length > 0) {
                //     const cats = filtros.categoria.map(c => String(c).toLowerCase().trim());
                //     query = query.contains('cats', cats);
                // }

                query = applySharedFilters(query, filtros, categoriaPorFactura, { usarCatsJson: true });
                if (filtros.canal) query = query.eq("tipo_canal", filtros.canal);

                const rows = await fetchAll(() => query, 800); // si quieres, baja a 800
                rows.sort((a, b) =>
                    (a.anio - b.anio) ||
                    (a.mes_num - b.mes_num) ||
                    String(a.tipo_canal).localeCompare(String(b.tipo_canal))
                );
                // const data = await fetchAll(() => query, 1000);
                setDatosCanal(rows || []);


                setDatosCanal(rows || []);

                // --- KPIs para CANAL desde la base extendida (evita doble conteo) ---
                const PAGE = 1000;
                let page = 0, _ventas = 0, _unidades = 0;
                const _facturas = new Set(), _clientes = new Set();

                while (true) {
                    let q = supabase
                        .from("v_consolidado_base_reconc_xcats_ext")
                        .select("total,cantidad,numero,id_cliente_final,anio,mes_en,categoria,talla,silueta,tipo_prenda,coleccion,print,color,canal_deducido,cats_json")
                        .eq("anio", filtros.anio)
                        .range(page * PAGE, page * PAGE + PAGE - 1);

                    // if (filtros.mes) q = q.eq("mes_en", filtros.mes);
                    // if (filtros.canal) q = q.eq("canal_deducido", filtros.canal);
                    // if (!categoriaPorFactura && filtros.categoria?.length > 0) {
                    //     q = q.in("categoria", filtros.categoria.map(c => c.toLowerCase()));
                    // }
                    // if (filtros.silueta) q = q.eq("silueta", filtros.silueta.toLowerCase());
                    // if (filtros.tipo_prenda) q = q.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
                    // if (filtros.talla) q = q.eq("talla", filtros.talla.toLowerCase());
                    // if (filtros.coleccion) q = q.eq("coleccion", String(filtros.coleccion).toLowerCase().trim());
                    // if (filtros.print_o_color?.length > 0) {
                    //     const orStr = buildPrintColorOr(filtros.print_o_color);
                    //     if (orStr) q = q.or(orStr);
                    // }
                    // if (categoriaPorFactura && filtros.categoria.length > 0) {
                    //     const cats = filtros.categoria.map(c => String(c).toLowerCase().trim());
                    //     q = q.filter("cats_json", "cs", JSON.stringify(cats));
                    // }


                    q = applySharedFilters(q, filtros, categoriaPorFactura, { usarCatsJson: true });
                    if (filtros.canal) q = q.eq("canal_deducido", filtros.canal);

                    const { data, error } = await q;
                    if (error) throw error;
                    const chunk = data || [];
                    for (const r of chunk) {
                        _ventas += Number(r.total || 0);
                        _unidades += Number(r.cantidad || 0);
                        if (r.numero) _facturas.add(r.numero);
                        if (r.id_cliente_final) _clientes.add(r.id_cliente_final);
                    }
                    if (chunk.length < PAGE) break;
                    page += 1;
                }

                setKpiVentas(_ventas);
                setKpiUnidades(_unidades);
                setKpiFacturas(_facturas.size);
                setKpiClientes(_clientes.size);


            } catch (err) {
                setError(err.message);
                // setDatosCanal([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPorCanal();
    }, [tipoReporte, filtros, categoriaPorFactura]);


    // ================== FETCH CATÁLOGOS ==================
    useEffect(() => {
        const fetchFiltros = async () => {
            // const { data: facturas } = await supabase.from("facturas").select("fecha_emision");
            const { data: añosRaw, error: yearsErr } = await supabase
                .from("v_anios_disponibles")
                .select("anio");


            if (yearsErr) throw yearsErr;
            // const { data: vista } = await supabase.from("v_consolidado_general_reconc").select("categoria, talla, silueta, tipo_prenda, print, color, coleccion"); fix colecciones 
            const { data: vista } = await supabase
                .from("v_consolidado_general_reconc")
                .select("categoria, talla, silueta, tipo_prenda, print, color, coleccion");

            // Fallback/union: algunas colecciones pueden estar en productos y NO en la vista
            const { data: prodCols } = await supabase
                .from("productos")
                .select("coleccion")
                .neq("coleccion", null);
            const { data: mesesRaw } = await supabase.from("v_consolidado_general_reconc").select("mes").neq("mes", null);
            const { data: tiendasRaw } = await supabase.from("v_ventas_por_tienda").select("nombre_tienda").neq("nombre_tienda", null);
            const { data: canalesRaw } = await supabase.from("v_ventas_por_canal").select("tipo_canal").neq("tipo_canal", null);

            // const años = [...new Set((facturas || []).map(f => new Date(f.fecha_emision).getFullYear()))].sort((a, b) => b - a);
            const años = (añosRaw || []).map(r => r.anio).filter(Boolean);
            const categorias = [...new Set((vista || []).map(p => p.categoria?.toLowerCase()).filter(Boolean))];
            const tallas = ordenarTallas([...new Set((vista || []).map(p => p.talla?.toLowerCase()).filter(Boolean))]);
            const siluetas = [...new Set((vista || []).map(p => p.silueta?.toLowerCase()).filter(Boolean))];
            const tiposPrenda = [...new Set((vista || []).map(p => p.tipo_prenda?.toLowerCase()).filter(Boolean))];
            const prints = [...new Set((vista || []).map(p => p.print?.toLowerCase()).filter(Boolean))];
            const colores = [...new Set((vista || []).map(p => p.color?.toLowerCase()).filter(Boolean))];
            // const colecciones = [...new Set((vista || []).map(p => p.coleccion?.toLowerCase()).filter(Boolean))]; fix colecciones
            const norm = (s) =>
                String(s ?? "")
                    .toLowerCase()
                    .trim();
            const coleccionesVista = (vista || [])
                .map(p => norm(p.coleccion))
                .filter(Boolean);
            const coleccionesProd = (prodCols || [])
                .map(p => norm(p.coleccion))
                .filter(Boolean);
            // Unión normalizada y orden alfabético
            const colecciones = Array.from(new Set([...coleccionesVista, ...coleccionesProd]))
                .sort((a, b) => a.localeCompare(b, "es"));

            const combinados = [
                ...prints.map(p => ({ tipo: "Print", valor: p })),
                ...colores.map(c => ({ tipo: "Color", valor: c }))
            ];

            const combinadosConLabel = [
                { value: 'sin print', label: 'Sin print' },
                { value: 'sin color', label: 'Sin color' },
                ...combinados.map(item => ({
                    value: item.valor,
                    label: `${item.tipo}: ${item.valor.charAt(0).toUpperCase() + item.valor.slice(1)}`
                }))
            ];

            const mesesUnicos = [...new Set((mesesRaw || []).map((m) => (m.mes || "").trim()))];
            const mesesOrdenLogico = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const traducciones = {
                January: "Enero", February: "Febrero", March: "Marzo", April: "Abril",
                May: "Mayo", June: "Junio", July: "Julio", August: "Agosto",
                September: "Septiembre", October: "Octubre", November: "Noviembre", December: "Diciembre"
            };
            const mesesOrdenadosTraducidos = mesesOrdenLogico
                .filter((mes) => mesesUnicos.includes(mes))
                .map((mesEn) => ({ en: mesEn, es: traducciones[mesEn] }));

            setAñosDisponibles(años);
            setCategoriasDisponibles(categorias);
            setTallasDisponibles(tallas);
            setSiluetasDisponibles(siluetas);
            setTiposPrendaDisponibles(tiposPrenda);
            setMesesDisponibles(mesesOrdenadosTraducidos);
            setPrintsYColoresDisponibles(combinadosConLabel);
            setColeccionesDisponibles(colecciones);
            const tiendasUnicas = [...new Set((tiendasRaw || []).map(t => t.nombre_tienda))].filter(Boolean);
            const canalesUnicos = [...new Set((canalesRaw || []).map(c => c.tipo_canal))].filter(Boolean);
            setTiendasDisponibles(tiendasUnicas);
            setCanalesDisponibles(canalesUnicos);
        };

        fetchFiltros();
    }, []);

    // ================== FETCH VENDEDOR ==================
    useEffect(() => {
        const fetchPorVendedor = async () => {
            // const { data: tiendasRaw } = await supabase
            //     .from("v_ventas_por_tienda")
            //     .select("nombre_tienda")
            //     .neq("nombre_tienda", null);

            // const tiendasUnicas = [...new Set((tiendasRaw || []).map(t => t.nombre_tienda))];
            // setTiendasDisponibles(tiendasUnicas);

            // setTiendasDisponibles(tiendasUnicas);

            if (tipoReporte !== "vendedor") return;

            setLoading(true);
            setError(null);

            try {
                let query = supabase
                    .from("v_ventas_por_vendedor")
                    .select("*")
                    .eq("anio", vendedoresFiltros.anio);

                if (vendedoresFiltros.mes) query = query.eq("mes_en", vendedoresFiltros.mes);
                if (vendedoresFiltros.tienda) query = query.eq("nombre_tienda", vendedoresFiltros.tienda);
                if (vendedoresFiltros.canal) query = query.eq("tipo_canal", vendedoresFiltros.canal);

                query = query.order('anio', { ascending: true }).order('mes_num', { ascending: true }).order('nombre_vendedor', { ascending: true });

                const data = await fetchAll(() => query, 1000);

                setDatosVendedor(data || []);
            } catch (err) {
                setError(err.message);
                setDatosVendedor([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPorVendedor();
    }, [tipoReporte, vendedoresFiltros]);


    // Cuando cambia el estado, refleja en URL (r=...) y guarda en localStorage
    useEffect(() => {
        try { localStorage.setItem(LS_KEY_REPORT, tipoReporte); } catch { }

        const current = params.get("r");
        // Si difiere, actualiza query param (replace para no llenar el historial)
        if (current !== tipoReporte) {
            const next = new URLSearchParams(params);
            // Si quieres URL limpia cuando es el default, puedes borrar el param:
            // (déjalo comentado si prefieres que siempre lo ponga)
            // if (!tipoReporte || tipoReporte === "consolidado") next.delete("r");
            // else next.set("r", tipoReporte);
            next.set("r", tipoReporte);
            setParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipoReporte]);

    // Si el usuario navega con atrás/adelante y cambia el ?r=..., sincroniza el estado
    useEffect(() => {
        const r = params.get("r");
        const fallback = (() => {
            try { return localStorage.getItem(LS_KEY_REPORT) || "consolidado"; } catch { return "consolidado"; }
        })();

        const effective = r || fallback;
        if (effective !== tipoReporte) {
            setTipoReporte(effective);
        }

        // Si no hay ?r= en URL pero sí en localStorage, escribe el param (opcional)
        if (!r && effective) {
            const next = new URLSearchParams(params);
            next.set("r", effective);
            setParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]);

    const [didInitYear, setDidInitYear] = useState(false);

    useEffect(() => {
        if (didInitYear) return;
        if (!añosDisponibles?.length) return;

        const y = new Date().getFullYear();
        const target = añosDisponibles.includes(y) ? y : añosDisponibles[0];

        setFiltros(f => ({ ...f, anio: target }));
        setVendedoresFiltros(v => ({ ...v, anio: target }));

        setDidInitYear(true);
    }, [añosDisponibles, didInitYear]);

    const totalVentas = kpiVentas;
    const totalUnidades = kpiUnidades;
    const totalFacturas = kpiFacturas;
    const totalClientes = kpiClientes;


    const exportarExcel = () => {
        const hoja = XLSX.utils.json_to_sheet(datosConsolidado);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Reporte");
        const excelBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(blob, `krobi_reporte_${tipoReporte}.xlsx`);
    };

    const exportarPDF = () => {
        const elemento = document.getElementById("reporte-content");
        html2canvas(elemento).then((canvas) => {
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const ancho = pdf.internal.pageSize.getWidth();
            const alto = (canvas.height * ancho) / canvas.width;
            pdf.addImage(imgData, "PNG", 0, 0, ancho, alto);
            pdf.save(`krobi_reporte_${tipoReporte}.pdf`);
        });
    };

    // ==== Transformaciones para gráficas de tienda ====
    // ==== Transformaciones para gráficas de canal ====
    const dataCanalParaGrafica = Object.entries(
        (datosCanal || []).reduce((acc, r) => {
            const k = normalizeCanal(r.tipo_canal || 'Sin canal');
            acc[k] = (acc[k] || 0) + Number(r.total || 0);
            return acc;
        }, {})
    ).map(([tipo_canal, total]) => ({ tipo_canal, total }));


    // const dataParaGrafica = Object.entries(datosAgrupadosPorTienda).map(([tienda, total]) => ({
    //     nombre_tienda: tienda,
    //     total: total
    // }));

    // --- Tema: observa cambios en <html class="dark"> y fuerza remount de react-select ---
    const [themeNonce, setThemeNonce] = useState(0);
    useEffect(() => {
        if (typeof document === "undefined") return;
        const el = document.documentElement;
        let last = el.classList.contains("dark");
        const obs = new MutationObserver(() => {
            const now = el.classList.contains("dark");
            if (now !== last) {
                last = now;
                setThemeNonce((n) => n + 1); // dispara re-render/remount
            }
        });
        obs.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);

    const isDarkNow =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

    // Estilos y tema recalculados cuando cambia la clase "dark"
    const selectStyles = useMemo(() => customSelectStyles(isDarkNow), [themeNonce]);
    const selectTheme = useMemo(
        () => (theme) => ({
            ...theme,
            colors: {
                ...theme.colors,
                primary: "#03A688",
                neutral0: isDarkNow ? "#0f172a" : "#ffffff",
                neutral80: isDarkNow ? "#e5e7eb" : "#111827",
                neutral20: isDarkNow ? "#334155" : "#e5e7eb",
                neutral30: isDarkNow ? "#475569" : "#d1d5db",
            },
        }),
        [themeNonce]
    );
    const menuPortalTarget =
        typeof document !== "undefined" ? document.body : undefined;



    // Normaliza texto: quita acentos, colapsa espacios, lower
    function canon(s) {
        return String(s ?? "")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }


    // Tamaño de página para KPIs desde la base extendida
    const PAGE_SIZE = 1000;

    // Aplica TODOS los filtros de forma consistente:
    // - Cuando categoriaPorFactura === true => usa cats_json (contener todas)
    // - Cuando === false => filtra por la columna categoria (row-level)
    function applySharedFilters(q, filtros, categoriaPorFactura, { usarCatsJson = true } = {}) {
        if (filtros.anio) q = q.eq("anio", Number(filtros.anio));
        if (filtros.mes) q = q.eq("mes_en", filtros.mes);

        if (filtros.silueta) q = q.eq("silueta", filtros.silueta.toLowerCase());
        if (filtros.tipo_prenda) q = q.eq("tipo_prenda", filtros.tipo_prenda.toLowerCase());
        if (filtros.talla) q = q.eq("talla", filtros.talla.toLowerCase());
        if (filtros.coleccion) q = q.eq("coleccion", String(filtros.coleccion).toLowerCase().trim());

        if (filtros.print_o_color?.length > 0) {
            const orStr = buildPrintColorOr(filtros.print_o_color);
            if (orStr) q = q.or(orStr);
        }

        // Categoría por factura (contener todas)
        if (filtros.categoria?.length > 0) {
            if (categoriaPorFactura && usarCatsJson) {
                const cats = filtros.categoria.map((c) => String(c).toLowerCase().trim());
                q = q.filter("cats_json", "cs", JSON.stringify(cats));
            } else {
                q = q.in("categoria", filtros.categoria.map((c) => c.toLowerCase()));
            }
        }

        return q;
    }


    // === Filtro y KPIs específicos para el reporte de TIENDA ===
    const datosTiendaFiltrados = useMemo(() => {
        if (!datosTienda || datosTienda.length === 0) return [];

        // Si no hay tiendas seleccionadas → usamos todas
        if (!filtros.tienda || filtros.tienda.length === 0) {
            return datosTienda;
        }

        const seleccionCanon = new Set((filtros.tienda || []).map(canon));

        return datosTienda.filter((row) => {
            const nombre = row?.nombre_tienda || "Sin tienda";
            return seleccionCanon.has(canon(nombre));
        });
    }, [datosTienda, filtros.tienda]);

    const kpiVentasTienda = useMemo(
        () => datosTiendaFiltrados.reduce((acc, r) => acc + Number(r.total || 0), 0),
        [datosTiendaFiltrados]
    );

    const kpiUnidadesTienda = useMemo(
        () => datosTiendaFiltrados.reduce((acc, r) => acc + Number(r.cantidad || 0), 0),
        [datosTiendaFiltrados]
    );

    const kpiFacturasTienda = useMemo(
        () => datosTiendaFiltrados.reduce((acc, r) => acc + Number(r.facturas || 0), 0),
        [datosTiendaFiltrados]
    );

    const kpiClientesTienda = useMemo(
        () => datosTiendaFiltrados.reduce((acc, r) => acc + Number(r.clientes_unicos || 0), 0),
        [datosTiendaFiltrados]
    );


    // Opciones de tienda SOLO para el reporte de tienda, basadas en los datos reales del reporte
    const tiendasOpcionesReporteTienda = useMemo(() => {
        if (!datosTienda || datosTienda.length === 0) return [];

        const nombres = Array.from(
            new Set(
                (datosTienda || []).map((row) =>
                    (row?.nombre_tienda || "Sin tienda").trim()
                )
            )
        ).sort((a, b) => a.localeCompare(b, "es"));

        return nombres.map((t) => ({ value: t, label: t }));
    }, [datosTienda]);


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-krobi mb-1">Dashboard de Reportes</h1>
                    <p className="text-gray-600 dark:text-gray-300">Selecciona el tipo de reporte que deseas consultar.</p>
                </div>
                <select
                    value={tipoReporte}
                    onChange={(e) => setTipoReporte(e.target.value)}
                    className="filtro w-full md:w-64"
                >
                    <option value="consolidado">Consolidado General</option>
                    <option value="canal">Ventas por Canal</option>
                    <option value="tienda">Ventas por Tienda</option>
                    <option value="vendedor">Ventas por Vendedor</option>
                    <option value="detalle">Ventas a Detalle</option>
                    <option value="inventarios">Inventarios</option>
                </select>
            </div>

            {tipoReporte !== "detalle" && tipoReporte !== "inventarios" && (
                <div className="flex gap-3 justify-end">
                    <button onClick={exportarExcel} className="text-sm bg-krobi text-white px-4 py-2 rounded-md hover:bg-krobi-dark transition">
                        Exportar Excel
                    </button>
                    <button onClick={exportarPDF} className="text-sm border border-krobi text-krobi px-4 py-2 rounded-md hover:bg-krobi-light transition">
                        Exportar PDF
                    </button>
                </div>
            )}

            <div id="reporte-content" className="space-y-6">
                <div id="reporte-content" className="space-y-6">
                    {/* Filtros (visibles para consolidado, canal y tienda). Vendedor usa panel propio */}

                    {tipoReporte !== "vendedor" && tipoReporte !== "detalle" && tipoReporte !== "inventarios" && (
                        // <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div key={`filters-${themeNonce}`} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Año */}
                            <select name="anio" value={filtros.anio} onChange={handleFiltro} className="filtro">
                                {añosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>

                            {/* Mes */}
                            <select name="mes" value={filtros.mes} onChange={handleFiltro} className="filtro">
                                <option value="">Todos los meses</option>
                                {mesesOrdenados.map((m) => <option key={m.en} value={m.en}>{m.es}</option>)}
                            </select>

                            {/* Filtros avanzados compartidos */}
                            <>
                                <Select
                                    key={`categoria-${themeNonce}`}
                                    isMulti
                                    name="categoria"
                                    placeholder="Categorías"
                                    options={categoriasDisponibles.map((c) => ({
                                        value: c,
                                        label: c.charAt(0).toUpperCase() + c.slice(1)
                                    }))}
                                    value={filtros.categoria.map((c) => ({
                                        value: c,
                                        label: c.charAt(0).toUpperCase() + c.slice(1)
                                    }))}
                                    onChange={(selected) => {
                                        const valores = (selected || []).map((s) => s.value);
                                        setFiltros({ ...filtros, categoria: valores });
                                    }}
                                    className="w-full md:w-auto"
                                    // styles={customSelectStyles(isDark)}
                                    styles={selectStyles}
                                    theme={selectTheme}
                                    classNamePrefix="rs"
                                    menuPortalTarget={menuPortalTarget}
                                    menuPosition="fixed"
                                />
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <input
                                        type="checkbox"
                                        checked={categoriaPorFactura}
                                        onChange={(e) => setCategoriaPorFactura(e.target.checked)}
                                    />
                                    Filtrar categorías por factura (contener todas)
                                </label>

                                <Select
                                    key={`silueta-${themeNonce}`}
                                    name="silueta"
                                    placeholder="Referencia"
                                    options={siluetasDisponibles.map((s) => ({
                                        value: s,
                                        label: s.charAt(0).toUpperCase() + s.slice(1)
                                    }))}
                                    value={filtros.silueta ? { value: filtros.silueta, label: filtros.silueta } : null}
                                    onChange={(selected) => setFiltros({ ...filtros, silueta: selected?.value || "" })}
                                    isClearable
                                    className="w-full md:w-auto"
                                    // styles={customSelectStyles(isDark)}

                                    styles={selectStyles}
                                    theme={selectTheme}
                                    classNamePrefix="rs"
                                    menuPortalTarget={menuPortalTarget}
                                    menuPosition="fixed"
                                />

                                <Select
                                    key={`tipo-${themeNonce}`}
                                    name="tipo_prenda"
                                    placeholder="Tipo de prenda"
                                    options={tiposPrendaDisponibles.map((p) => ({ value: p, label: p }))}
                                    value={filtros.tipo_prenda ? { value: filtros.tipo_prenda, label: filtros.tipo_prenda } : null}
                                    onChange={(selected) => setFiltros({ ...filtros, tipo_prenda: selected?.value || "" })}
                                    isClearable
                                    className="w-full md:w-auto"
                                    // styles={customSelectStyles(isDark)}
                                    styles={selectStyles}
                                    theme={selectTheme}
                                    classNamePrefix="rs"
                                    menuPortalTarget={menuPortalTarget}
                                    menuPosition="fixed"
                                />

                                <Select
                                    key={`printcolor-${themeNonce}`}
                                    isMulti
                                    name="print_o_color"
                                    placeholder="Print / Color"
                                    options={printsYColoresDisponibles}
                                    value={printsYColoresDisponibles.filter(o => filtros.print_o_color.includes(o.value))}
                                    onChange={(selected) => {
                                        const valores = (selected || []).map((s) => s.value);
                                        setFiltros({ ...filtros, print_o_color: valores });
                                    }}
                                    className="w-full md:w-auto"
                                    // styles={customSelectStyles(isDark)}
                                    styles={selectStyles}
                                    theme={selectTheme}
                                    classNamePrefix="rs"
                                    menuPortalTarget={menuPortalTarget}
                                    menuPosition="fixed"
                                />
                                {/* Colección */}
                                <select name="coleccion" value={filtros.coleccion} onChange={handleFiltro} className="filtro">
                                    <option value="">Todas las colecciones</option>
                                    {coleccionesDisponibles.map((c) => (
                                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                    ))}
                                </select>
                                <select name="talla" value={filtros.talla} onChange={handleFiltro} className="filtro">
                                    <option value="">Todas las tallas</option>
                                    {tallasDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>

                                {/* Solo para TIENDA: selector de tienda desplegable reporte por tienda*/}
                                {tipoReporte === "tienda" && (
                                    <Select
                                        key={`tienda-${themeNonce}`}
                                        isMulti
                                        name="tienda"
                                        placeholder="Tiendas"
                                        options={tiendasOpcionesReporteTienda}
                                        value={(filtros.tienda || []).map((t) => ({
                                            value: t,
                                            label: t,
                                        }))}
                                        onChange={(selected) => {
                                            const values = (selected || []).map((s) => s.value);
                                            setFiltros({ ...filtros, tienda: values });
                                        }}
                                        className="w-full md:w-auto"
                                        styles={selectStyles}
                                        theme={selectTheme}
                                        classNamePrefix="rs"
                                        menuPortalTarget={menuPortalTarget}
                                        menuPosition="fixed"
                                    />
                                )}

                                {/* Solo para CANAL: selector de canal */}
                                {tipoReporte === "canal" && (
                                    <select name="canal" value={filtros.canal} onChange={handleFiltro} className="filtro">
                                        <option value="">Todos los canales</option>
                                        {canalesDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}
                            </>
                        </div>
                    )}

                    {/* ======= CONSOLIDADO ======= */}
                    {tipoReporte === "consolidado" && (
                        <>
                            {loading ? (
                                <KroBiLoader
                                    message="Cargando magia de KroBi…"
                                    subtext="Consultando Supabase y afinando filtros"
                                    inline={false}
                                />
                            ) : !online || netError ? (
                                <KroBiNoNetwork
                                    message="¿Sin red? KroBi quedó partido a la mitad…"
                                    subtext={navigator.onLine ? "Servidor inalcanzable. Intenta de nuevo." : "Parece que estás offline."}
                                    onRetry={handleRetry}
                                />
                            ) : datosConsolidado.length === 0 ? (
                                <KroBiNoData
                                    message="No hay resultados para los filtros seleccionados."
                                    subtext="Prueba quitando alguno o usa el botón para limpiar."
                                    onResetFilters={() => setFiltros(INIT_FILTROS)} // opcional
                                />
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <KpiCard title="Ventas Totales" value={formatoCOP(totalVentas)} />
                                        <KpiCard title="Unidades Vendidas" value={totalUnidades.toLocaleString()} />
                                        <KpiCard title="Facturas Emitidas" value={totalFacturas.toLocaleString()} />
                                        <KpiCard title="Clientes Únicos" value={totalClientes.toLocaleString()} />
                                    </div>

                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={serieMensual} margin={{ top: 20, right: 30, left: 50, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="mes" />
                                            <YAxis tickFormatter={formatoUnidades} />
                                            <Tooltip formatter={(value) => formatoUnidades(value)} />
                                            <Line type="monotone" dataKey="unidades" stroke="#03A688" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </>
                    )}

                    {/* ======= CANAL ======= */}
                    {tipoReporte === "canal" && (
                        <Suspense fallback={<KroBiLoader />}>
                            <VentasPorCanal
                                loading={loading}
                                datosCanal={datosCanal}
                                formatoCOP={formatoCOP}
                                kpiVentas={totalVentas}
                                kpiUnidades={totalUnidades}
                                kpiFacturas={totalFacturas}
                                kpiClientes={totalClientes}
                                onResetFilters={() => setFiltros(INIT_FILTROS)}
                            />
                        </Suspense>
                    )}

                    {tipoReporte === "canal2" && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Ventas por Canal</h2>
                            {loading ? (
                                <KroBiLoader
                                    message="Cargando magia de KroBi…"
                                    subtext="Consultando Supabase y afinando filtros"
                                    inline={false}
                                />
                            ) : datosCanal.length === 0 ? (
                                <KroBiNoData
                                    message="No hay resultados para los filtros seleccionados."
                                    subtext="Prueba quitando alguno o usa el botón para limpiar."
                                    onResetFilters={() => setFiltros(INIT_FILTROS)} // opcional
                                />
                            ) : (
                                <>
                                    {/* KPIs arriba */}
                                    {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {dataCanalParaGrafica.map(({ tipo_canal, total }) => (
                                            <KpiCard key={tipo_canal} title={`Ventas en ${tipo_canal}`} value={formatoCOP(total)} />
                                        ))}
                                    </div> */}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <KpiCard title="Ventas Totales" value={formatoCOP(totalVentas)} />
                                        <KpiCard title="Unidades Vendidas" value={totalUnidades.toLocaleString()} />
                                        <KpiCard title="Facturas Emitidas" value={totalFacturas.toLocaleString()} />
                                        <KpiCard title="Clientes Únicos" value={totalClientes.toLocaleString()} />
                                    </div>

                                    {/* Gráfica abajo */}
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart data={dataCanalParaGrafica} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="tipo_canal" />
                                            <YAxis tickFormatter={(v) => formatoCOP(v)} />
                                            <Tooltip formatter={(value) => formatoCOP(value)} labelFormatter={(label) => `Canal: ${label}`} />
                                            <Bar dataKey="total" fill="#03A688" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </div>
                    )}

                    {/* ======= TIENDA ======= */}
                    {tipoReporte === "tienda" && (
                        // <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm space-y-4">
                        //     <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Ventas por Tienda</h2>

                        //     {loading ? (
                        //         <KroBiLoader
                        //             message="Cargando magia de KroBi…"
                        //             subtext="Consultando Supabase y afinando filtros"
                        //             inline={false}
                        //         />
                        //     ) : datosTienda.length === 0 ? (
                        //         <KroBiNoData
                        //             message="No hay resultados para los filtros seleccionados."
                        //             subtext="Prueba quitando alguno o usa el botón para limpiar."
                        //             onResetFilters={() => setFiltros(INIT_FILTROS)} // opcional
                        //         />
                        //     ) : (
                        //         <>
                        //             {/* KPIs por canal */}
                        //             {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        //                 {Object.entries(ventasPorCanal).map(([canal, total]) => (
                        //                     <KpiCard key={canal} title={`Ventas en ${canal}`} value={formatoCOP(total)} />
                        //                 ))}
                        //             </div> */}

                        //             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        //                 <KpiCard title="Ventas Totales" value={formatoCOP(totalVentas)} />
                        //                 <KpiCard title="Unidades Vendidas" value={totalUnidades.toLocaleString()} />
                        //                 <KpiCard title="Facturas Emitidas" value={totalFacturas.toLocaleString()} />
                        //                 <KpiCard title="Clientes Únicos" value={totalClientes.toLocaleString()} />
                        //             </div>

                        //             {/* Gráfico por tienda */}
                        //             <ResponsiveContainer width="100%" height={400}>
                        //                 <BarChart data={dataParaGrafica} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
                        //                     <CartesianGrid strokeDasharray="3 3" />
                        //                     <XAxis dataKey="nombre_tienda" angle={-15} textAnchor="end" interval={0} />
                        //                     <YAxis tickFormatter={(v) => formatoCOP(v)} />
                        //                     <Tooltip formatter={(value) => formatoCOP(value)} labelFormatter={(label) => `Tienda: ${label}`} />
                        //                     <Bar dataKey="total" fill="#03A688" />
                        //                 </BarChart>
                        //             </ResponsiveContainer>
                        //         </>
                        //     )}
                        // </div>
                        <Suspense fallback={<KroBiLoader />}>
                            <VentasPorTienda
                                loading={loading}
                                datosTienda={datosTiendaFiltrados}
                                formatoCOP={formatoCOP}
                                kpiVentas={kpiVentasTienda}
                                kpiUnidades={kpiUnidadesTienda}
                                kpiFacturas={kpiFacturasTienda}
                                kpiClientes={kpiClientesTienda}
                                onResetFilters={() => setFiltros(INIT_FILTROS)}
                            />
                        </Suspense>
                    )}

                    {/* ======= VENDEDOR ======= */}
                    {tipoReporte === "vendedor" && (
                        // <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                        //     <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Ventas por Vendedor</h2>

                        //     {/* Filtros */}
                        //     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        //         <select name="anio" value={vendedoresFiltros.anio} onChange={handleFiltroVendedor} className="filtro">
                        //             {añosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
                        //         </select>
                        //         <select name="mes" value={vendedoresFiltros.mes} onChange={handleFiltroVendedor} className="filtro">
                        //             <option value="">Todos los meses</option>
                        //             {mesesDisponibles.map((m) => <option key={m.en} value={m.en}>{m.es}</option>)}
                        //         </select>
                        //         <select name="tienda" value={vendedoresFiltros.tienda} onChange={handleFiltroVendedor} className="filtro">
                        //             <option value="">Todas las tiendas</option>
                        //             {tiendasDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
                        //         </select>
                        //     </div>

                        //     {/* Resultados */}
                        //     {loading ? (
                        //         <KroBiLoader
                        //             message="Cargando magia de KroBi…"
                        //             subtext="Consultando Supabase y afinando filtros"
                        //             inline={false}
                        //         />
                        //     ) : datosVendedor.length === 0 ? (
                        //         <KroBiNoData
                        //             message="No hay resultados para los filtros seleccionados."
                        //             subtext="Prueba quitando alguno o usa el botón para limpiar."
                        //             onResetFilters={() => setFiltros(INIT_FILTROS)} // opcional
                        //         />
                        //     ) : (
                        //         <ResponsiveContainer width="100%" height={400}>
                        //             {/* <BarChart data={datosVendedor} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                        //                 <CartesianGrid strokeDasharray="3 3" />
                        //                 <XAxis dataKey="nombre_vendedor" />
                        //                 <YAxis tickFormatter={(v) => formatoCOP(v)} />
                        //                 <Tooltip formatter={(value) => formatoCOP(value)} labelFormatter={(label) => `Vendedor: ${label}`} />
                        //                 <Bar dataKey="total" fill="#03A688" />
                        //             </BarChart> */}
                        //             <BarChart
                        //                 data={dataVendedorParaGrafica}
                        //                 margin={{ top: 16, right: 16, left: 8, bottom: 96 }}  // espacio para etiquetas rotadas
                        //             >
                        //                 <CartesianGrid strokeDasharray="3 3" />
                        //                 <XAxis
                        //                     dataKey="nombre_vendedor"  // ya traemos nombre
                        //                     interval={0}               // muestra todas las etiquetas
                        //                     angle={-80}                // casi vertical
                        //                     textAnchor="end"
                        //                     height={90}                // espacio bajo el chart
                        //                     tick={{ fontSize: 11 }}    // opcional: ajusta legibilidad
                        //                 />
                        //                 <YAxis tickFormatter={(v) => formatoCOP(v)} />
                        //                 <Tooltip
                        //                     formatter={(v) => formatoCOP(v)}
                        //                     labelFormatter={(l) => `Vendedor: ${l}`} // tooltip muestra el nombre completo
                        //                 />
                        //                 <Bar dataKey="total" fill="#03A688" />
                        //             </BarChart>
                        //         </ResponsiveContainer>
                        //     )}
                        // </div>

                        <Suspense fallback={null}>
                            <VentasPorVendedor
                                loading={loading}
                                datosVendedor={datosVendedor}
                                formatoCOP={formatoCOP}
                                filtros={vendedoresFiltros}
                                añosDisponibles={añosDisponibles}
                                mesesDisponibles={mesesDisponiblesVendedor.length ? mesesDisponiblesVendedor : mesesDisponibles}
                                tiendasDisponibles={tiendasDisponibles}
                                onChangeFiltros={handleFiltroVendedor}
                                onResetFilters={() =>
                                    setVendedoresFiltros((prev) => ({
                                        ...prev,
                                        mes: "",
                                        tienda: "",
                                        canal: "",
                                    }))
                                }
                            />
                        </Suspense>
                    )}

                    {/* ======= DETALLE ======= */}
                    {tipoReporte === "detalle" && (
                        <Suspense fallback={<KroBiLoader />}>
                            <VentasDetalle /* si usas cliente central: supabase={supabase} */ />
                        </Suspense>
                    )}

                    {tipoReporte === "inventarios" && (
                        <React.Suspense fallback={<KroBiLoader />}>
                            <Inventarios />
                        </React.Suspense>
                    )}
                </div>
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

// ===== Utils =====

async function fetchAll(buildQuery, pageSize = 1000) {
    let all = [];
    let from = 0;
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

function normalizeCanal(s) {
    if (!s) return 'Sin canal';
    const t = String(s).toLowerCase();
    if (/f[ií]sica/.test(t) || /f[ií]sico/.test(t)) return 'Físico';
    return s;
}

// Recibe array de strings seleccionados en el multi-select de "Print/Color"
// Devuelve string para usar en .or() de Supabase
function buildPrintColorOr(selected) {
    if (!selected || selected.length === 0) return null;
    const parts = [];
    for (const raw of selected) {
        const v = String(raw).toLowerCase().trim();
        if (v === "sin print") { parts.push(`print.eq.sin print`); continue; }
        if (v === "sin color") { parts.push(`color.eq.sin color`); continue; }
        const safe = v.replace(/[(),]/g, " ");
        parts.push(`print.ilike.*${safe}*`);
        parts.push(`color.ilike.*${safe}*`);
    }
    return parts.join(",");
}











