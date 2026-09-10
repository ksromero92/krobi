import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { getSupabase } from '@/lib/supabaseClient';
import * as XLSX from "xlsx";
import KroBiLoader from "../components/KroBiLoader";
import KroBiNoData from "../components/KroBiNoData";

// === Config ===
const PAGE_SIZE = 25;
const supabase = getSupabase();
const EXCEL_CELL_LIMIT = 32767;
const TZ = "America/Bogota";
// Catálogo (igual al original)
const CATALOG = [
    {
        group: "Vistas de negocio (lectura)",
        items: [
            { key: "v_ventas_detalle", label: "Ventas – Detalle", readOnly: true },
            { key: "v_ventas_por_tienda", label: "Ventas por Tienda", readOnly: true },
            { key: "v_ventas_por_canal", label: "Ventas por Canal", readOnly: true },
            { key: "v_ventas_por_vendedor", label: "Ventas por Vendedor", readOnly: true },
            { key: "v_consolidado_general_reconc_xcats", label: "Consolidado General (xcats)", readOnly: true },
        ],
    },
    {
        group: "Tablas maestras",
        items: [
            { key: "productos", label: "Productos" },
            { key: "tiendas", label: "Tiendas" },
            { key: "vendedores", label: "Vendedores" },
            { key: "clientes_finales", label: "Clientes Finales" },
        ],
    },
    {
        group: "Transaccionales",
        items: [
            { key: "facturas", label: "Facturas" },
            // { key: "factura_items", label: "Factura Items" },
        ],
    },
    {
        group: "Soporte / Operación",
        items: [
            { key: "inventarios", label: "Inventarios" },
            // { key: "homologacion_productos", label: "Homologación Productos" },
            // { key: "logs_procesos_integracion", label: "Logs Integración" },
            // { key: "config_limites", label: "Config Límites" },
        ],
    },
];

// Operadores disponibles y su traducción a PostgREST (Supabase)
const OPERATORS = [
    { op: "=", apply: (q, f, v) => q.eq(f, v) },
    { op: "!=", apply: (q, f, v) => q.neq(f, v) },
    { op: ">", apply: (q, f, v) => q.gt(f, v) },
    { op: "<", apply: (q, f, v) => q.lt(f, v) },
    { op: ">=", apply: (q, f, v) => q.gte(f, v) },
    { op: "<=", apply: (q, f, v) => q.lte(f, v) },
    { op: "contiene", apply: (q, f, v) => q.ilike(f, `%${v}%`) },
    {
        op: "entre",
        apply: (q, f, v) => {
            if (!Array.isArray(v) || v.length < 2) return q;
            const [a, b] = v;
            let res = q;
            if (a !== "" && a !== null) res = res.gte(f, a);
            if (b !== "" && b !== null) res = res.lte(f, b);
            return res;
        },
    },
];

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




export default function DataExplorer() {
    // const [tableKey, setTableKey] = useState(CATALOG[0].items[0].key); estado inicial

    // Persistencia silenciosa de la tabla seleccionada (URL + localStorage)
    const [params, setParams] = useSearchParams();
    const { pathname } = useLocation(); // reservado por si luego quieres llaves por ruta
    const LS_KEY_TABLE = "krobi:/data:t";

    // Todas las keys válidas del catálogo (para validar valores viejos)
    const ALL_KEYS = useMemo(() => {
        return CATALOG.flatMap(g => g.items.map(i => i.key));
    }, []);

    function ensureValidKey(k) {
        return ALL_KEYS.includes(k) ? k : CATALOG[0].items[0].key;
    }

    function getInitialTable() {
        // 1) URL (?t=), 2) localStorage, 3) primera del catálogo
        const fromURL = params.get("t");
        if (fromURL) return ensureValidKey(fromURL);
        try {
            const ls = localStorage.getItem(LS_KEY_TABLE);
            if (ls) return ensureValidKey(ls);
        } catch { }
        return CATALOG[0].items[0].key;
    }

    const [tableKey, setTableKey] = useState(getInitialTable());


    const [columns, setColumns] = useState([]);        // columnas visibles
    const [rawColumns, setRawColumns] = useState([]);  // columnas originales (para export)
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [sort, setSort] = useState({ field: null, asc: true });
    const [filters, setFilters] = useState([{ field: "", op: "=", value: "" }]);

    // Panel JSON amigable
    const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
    const [jsonPanelData, setJsonPanelData] = useState(null);
    const [jsonPanelTitle, setJsonPanelTitle] = useState("");

    const [editingProduct, setEditingProduct] = useState(null);
    const [editingValues, setEditingValues] = useState({});
    const [editingSaving, setEditingSaving] = useState(false);


    const [tallasCatalogo, setTallasCatalogo] = useState([]);
    const [siluetasCatalogo, setSiluetasCatalogo] = useState([]);
    const [tiposPrendaCatalogo, setTiposPrendaCatalogo] = useState([]);
    const [printsCatalogo, setPrintsCatalogo] = useState([]);
    const [coloresCatalogo, setColoresCatalogo] = useState([]);
    const [coleccionesCatalogo, setColeccionesCatalogo] = useState([]);


    // Heurísticas de tipo
    const isDateField = (f) => /(fecha|_at|fecha_emision|fecha_vencimiento)/i.test(f);
    const isNumericField = (f) =>
        /(total|cantidad|precio|impuesto|subtotal|balance|anio|mes_num|clientes_unicos|facturas)/i.test(f);
    const isIdLike = (f) => /(^id($|_))|(_id$)|(^.*uuid.*$)/i.test(f);
    const isUrlField = (f) => /(url|public_url|link|enlace)/i.test(f);

    // Helpers de campos específicos
    const norm = (s) => (s ?? "").toString().toLowerCase().replace(/\s|_/g, "");
    const isFormaPagoField = (f) => /forma.*pago/.test(norm(f));
    const isMetodoPagoField = (f) => /metodo.*pago/.test(norm(f));
    // reconocer itemjson/items_json/item_json
    const isItemJsonField = (f) => {
        const n = norm(f);
        return n === "itemjson" || n === "itemsjson" || /items?json$/.test(n);
    };
    const isTerminosField = (f) => norm(f) === "terminos";
    const isCufeField = (f) => norm(f) === "cufe";

    // Ocultar IDs/UUIDs + ocultar "terminos" y "cufe" cuando tabla === facturas
    const visibleColumns = (all) =>
        (all || []).filter((c) => {
            if (isIdLike(c)) return false;
            if (tableKey === "facturas" && (isTerminosField(c) || isCufeField(c))) return false;
            return true;
        });

    const currentCatalogItem = useMemo(() => {
        for (const group of CATALOG) {
            const found = group.items.find((i) => i.key === tableKey);
            if (found) return { ...found, group: group.group };
        }
        return null;
    }, [tableKey]);

    useEffect(() => {
        document.body.classList.toggle(
            "dark",
            localStorage.getItem("theme") === "dark"
        );
    }, []);

    useEffect(() => {
        setPage(1);
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableKey, sort]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);


    // Cuando cambia la tabla, guarda en URL (?t=...) y en localStorage
    useEffect(() => {
        try { localStorage.setItem(LS_KEY_TABLE, tableKey); } catch { }

        const current = params.get("t");
        if (current !== tableKey) {
            const next = new URLSearchParams(params);
            // Si prefieres URL limpia cuando es la default, podrías borrar el param:
            // if (tableKey === CATALOG[0].items[0].key) next.delete("t");
            // else next.set("t", tableKey);
            next.set("t", tableKey);
            setParams(next, { replace: true }); // replace para no llenar el historial
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableKey]);

    // Si el usuario navega con atrás/adelante y cambia ?t=..., refleja en el estado
    useEffect(() => {
        const t = params.get("t");
        const fallback = (() => {
            try { return localStorage.getItem(LS_KEY_TABLE) || CATALOG[0].items[0].key; } catch { return CATALOG[0].items[0].key; }
        })();
        const effective = ensureValidKey(t || fallback);

        if (effective !== tableKey) {
            setTableKey(effective);
        }

        // Si no hay ?t= pero sí localStorage, escribe el param (opcional)
        if (!t && effective) {
            const next = new URLSearchParams(params);
            next.set("t", effective);
            setParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]);



    useEffect(() => {
        const fetchCatalogos = async () => {
            // Vista consolidada principal
            const { data: vista } = await supabase
                .from("v_consolidado_general_reconc")
                .select("talla,silueta,tipo_prenda,print,color,coleccion");

            // Colecciones adicionales que solo estén en productos
            const { data: prodCols } = await supabase
                .from("productos")
                .select("coleccion")
                .neq("coleccion", null);

            const norm = (s) =>
                String(s ?? "")
                    .toLowerCase()
                    .trim();

            const tallas = ordenarTallas(
                [...new Set((vista || []).map(p => p.talla?.toLowerCase()).filter(Boolean))]
            );
            const siluetas = [...new Set((vista || []).map(p => norm(p.silueta)).filter(Boolean))];
            const tiposPrenda = [...new Set((vista || []).map(p => norm(p.tipo_prenda)).filter(Boolean))];
            const prints = [...new Set((vista || []).map(p => norm(p.print)).filter(Boolean))];
            const colores = [...new Set((vista || []).map(p => norm(p.color)).filter(Boolean))];

            const coleccionesVista = (vista || [])
                .map(p => norm(p.coleccion))
                .filter(Boolean);
            const coleccionesProd = (prodCols || [])
                .map(p => norm(p.coleccion))
                .filter(Boolean);
            const colecciones = Array.from(new Set([...coleccionesVista, ...coleccionesProd]))
                .sort((a, b) => a.localeCompare(b, "es"));

            setTallasCatalogo(tallas);
            setSiluetasCatalogo(siluetas);
            setTiposPrendaCatalogo(tiposPrenda);
            setPrintsCatalogo(prints);
            setColoresCatalogo(colores);
            setColeccionesCatalogo(colecciones);
        };

        fetchCatalogos();
    }, []);


    async function load(customExportAll = false) {
        setLoading(true);

        let query = supabase.from(tableKey).select("*", { count: "exact" });

        // filtros
        for (const f of filters) {
            const field = f.field;
            if (!field) continue;
            const operator = OPERATORS.find((o) => o.op === f.op);
            if (!operator) continue;
            query = operator.apply(query, field, f.op === "entre" ? f.value : castValue(field, f.value));
        }

        // orden
        if (sort.field) {
            query = query.order(sort.field, { ascending: sort.asc, nullsFirst: false });
        }

        // paginación
        if (!customExportAll) {
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);
        }

        const { data, error, count } = await query;
        if (error) {
            console.error("Error cargando", tableKey, error);
            setRows([]);
            setTotal(0);
            setColumns([]);
            setRawColumns([]);
        } else {
            setRows(data || []);
            setTotal(typeof count === "number" ? count : (data?.length || 0));

            let allCols = [];
            if (data && data.length) {
                allCols = Object.keys(data[0]);
            } else {
                const probe = await supabase.from(tableKey).select("*").limit(1);
                if (!probe.error && probe.data && probe.data.length) {
                    allCols = Object.keys(probe.data[0]);
                }
            }
            setRawColumns(allCols);
            setColumns(visibleColumns(allCols));

            // si algún filtro quedó apuntando a una columna oculta, lo limpiamos
            setFilters((prev) =>
                prev.map((f) => (visibleColumns(allCols).includes(f.field) ? f : { ...f, field: "" }))
            );
        }

        setLoading(false);
    }

    function castValue(field, value) {
        if (value === null || value === undefined) return value;
        const v = String(value).trim();
        if (v === "") return v;
        if (isNumericField(field)) {
            const num = Number(v.replace(/,/g, "."));
            return isNaN(num) ? v : num;
        }
        return v;
    }

    function addFilter() {
        setFilters((f) => [...f, { field: "", op: "=", value: "" }]);
    }

    function removeFilter(i) {
        setFilters((f) => f.filter((_, idx) => idx !== i));
    }

    function updateFilter(i, key, val) {
        setFilters((prev) => {
            const copy = [...prev];
            copy[i] = { ...copy[i], [key]: val };
            if (key === "op" && val === "entre") copy[i].value = ["", ""];
            if (key === "op" && val !== "entre" && Array.isArray(copy[i].value)) copy[i].value = "";
            return copy;
        });
    }

    function onHeaderClick(field) {
        setSort((s) => {
            if (s.field === field) return { field, asc: !s.asc };
            return { field, asc: true };
        });
    }


    async function exportToExcel() {
        setLoading(true);

        try {
            // 1) armamos query base con filtros
            let base = supabase.from(tableKey).select("*", { count: "exact" });

            for (const f of filters) {
                const field = f.field;
                if (!field) continue;
                const operator = OPERATORS.find((o) => o.op === f.op);
                if (!operator) continue;
                base = operator.apply(base, field, f.op === "entre" ? f.value : castValue(field, f.value));
            }

            if (sort.field) base = base.order(sort.field, { ascending: sort.asc });

            // PostgREST / Supabase suele limitar el page size real a 1000
            const PAGE_SIZE = 1000;

            const all = [];
            let from = 0;

            while (true) {
                const to = from + PAGE_SIZE - 1;

                let q = supabase.from(tableKey).select("*");

                for (const f of filters) {
                    const field = f.field;
                    if (!field) continue;
                    const operator = OPERATORS.find((o) => o.op === f.op);
                    if (!operator) continue;
                    q = operator.apply(q, field, f.op === "entre" ? f.value : castValue(field, f.value));
                }

                if (sort.field) {
                    q = q.order(sort.field, { ascending: sort.asc });
                    // desempate estable si existe "id"
                    q = q.order("id", { ascending: true });
                } else {
                    // orden por defecto estable
                    q = q.order("id", { ascending: true });
                }


                const { data, error } = await q.range(from, to);
                if (error) throw error;

                const batch = data || [];
                if (batch.length === 0) break;

                all.push(...batch);

                // si llegó menos del máximo real, ya no hay más filas
                if (batch.length < PAGE_SIZE) break;

                from += PAGE_SIZE;
            }


            // 4) columnas visibles y sanitización
            const cols = visibleColumns(all?.[0] ? Object.keys(all[0]) : rawColumns);

            // 5) formatear valores para Excel (fechas amigables, etc.)
            const sanitized = all.map((row) => {
                const obj = {};
                for (const c of cols) {
                    const v = row[c];

                    if (v === null || v === undefined) obj[c] = "";
                    else if (typeof v === "object") {
                        // stringify puede ser gigante → lo hacemos seguro
                        obj[c] = toExcelSafeText(JSON.stringify(v));
                    } else {
                        const s = String(v);

                        if (isDateField(c) || isIsoDateString(s)) {
                            obj[c] = toExcelSafeText(formatExcelDate(s));
                        } else {
                            // cualquier string largo también se trunca
                            obj[c] = typeof v === "string" ? toExcelSafeText(v) : v;
                        }
                    }
                }
                return obj;
            });

            // 6) generar Excel
            const ws = XLSX.utils.json_to_sheet(sanitized);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, tableKey);

            const filename = `${tableKey}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (e) {
            console.error("Error exportando:", e);
            alert(`Error exportando: ${e?.message || e}`);
        } finally {
            setLoading(false);
        }
    }


    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Utilidades para panel JSON
    function openJsonPanel(title, data) {
        setJsonPanelTitle(title || "Detalle");
        setJsonPanelData(data);
        setJsonPanelOpen(true);
    }
    function closeJsonPanel() {
        setJsonPanelOpen(false);
        setJsonPanelData(null);
        setJsonPanelTitle("");
    }
    function tryParseJson(val) {
        if (typeof val === "string") {
            try { return JSON.parse(val); } catch { /* noop */ }
        }
        return val;
    }


    // Abrir editor de producto (solo cuando la tabla es "productos")
    function openProductEditor(row) {
        if (tableKey !== "productos") return;

        setEditingProduct(row);
        setEditingValues({
            // campos EDITABLES según tu schema
            nombre_estandarizado: row.nombre_estandarizado || "",
            silueta: row.silueta || "",
            genero: row.genero || "",
            tipo_prenda: row.tipo_prenda || "",
            talla: row.talla || "",
            color: row.color || "",
            print: row.print || "",
            coleccion: row.coleccion || "",
            homologado: row.homologado || "",
            tipo: row.tipo || "",
        });
    }



    // === 👇 NUEVO: helpers para renderizar tabla en el panel ===
    function formatCellValue(v) {
        if (v === null || v === undefined) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            return String(v);
        }
        // Objetos/arrays anidados: pretty JSON dentro de la celda
        return (
            <pre className="whitespace-pre-wrap text-[11px] leading-snug">
                {JSON.stringify(v, null, 2)}
            </pre>
        );
    }

    function collectColumns(arr) {
        const cols = new Set();
        for (const item of arr) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
                Object.keys(item).forEach((k) => cols.add(k));
            } else {
                cols.add("valor"); // para arrays de primitivos
            }
        }
        return Array.from(cols);
    }

    function renderJsonPanelContent(data) {
        if (data === null || data === undefined) {
            return <div className="text-xs text-gray-500 dark:text-gray-400">Sin datos</div>;
        }

        // Array (objetos o primitivos)
        if (Array.isArray(data)) {
            if (data.length === 0) {
                return <div className="text-xs text-gray-500 dark:text-gray-400">Sin datos</div>;
            }

            const columns = collectColumns(data);

            // Caso: array de primitivos → una columna "valor"
            if (columns.length === 1 && columns[0] === "valor") {
                return (
                    <table className="min-w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800">
                                <th className="px-2 py-2 border dark:border-gray-700 text-left">valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((val, i) => (
                                <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800">
                                    <td className="px-2 py-2 border dark:border-gray-700 align-top">
                                        {formatCellValue(val)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            }

            // Caso: array de objetos → unión de claves como columnas
            return (
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            {columns.map((c) => (
                                <th key={c} className="px-2 py-2 border dark:border-gray-700 text-left">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800" onClick={() => {
                                if (tableKey === "productos") openProductEditor(row);
                            }}>
                                {columns.map((c) => (
                                    <td key={c} className="px-2 py-2 border dark:border-gray-700 align-top">
                                        {formatCellValue(row && typeof row === "object" ? row[c] : undefined)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        // Objeto único → tabla clave/valor
        if (data && typeof data === "object") {
            const entries = Object.entries(data);
            if (entries.length === 0) {
                return <div className="text-xs text-gray-500 dark:text-gray-400">Sin datos</div>;
            }
            return (
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="px-2 py-2 border dark:border-gray-700 text-left">campo</th>
                            <th className="px-2 py-2 border dark:border-gray-700 text-left">valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(([k, v]) => (
                            <tr key={k} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-900 dark:even:bg-gray-800">
                                <td className="px-2 py-2 border dark:border-gray-700 align-top font-medium">{k}</td>
                                <td className="px-2 py-2 border dark:border-gray-700 align-top">{formatCellValue(v)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        // Primitivo suelto
        return (
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="px-2 py-2 border dark:border-gray-700 text-left">valor</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="bg-white dark:bg-gray-900">
                        <td className="px-2 py-2 border dark:border-gray-700">{formatCellValue(data)}</td>
                    </tr>
                </tbody>
            </table>
        );
    }
    // === ☝️ FIN helpers panel ===


    function toLowerOrNull(v) {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s === "" ? null : s.toLowerCase();
    }


    // === Fechas amigables (Colombia) ===

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function formatExcelDate(value) {
        if (!value) return "";
        const s = String(value);
        if (!isIsoDateString(s)) return s;

        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return s;

        // Formateo en hora Colombia
        const parts = new Intl.DateTimeFormat("es-CO", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(d);

        const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";

        // dd/mm/aaaa HH:mm:ss
        return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
    }

    function toExcelSafeText(value) {
        if (value === null || value === undefined) return "";
        let s = typeof value === "string" ? value : String(value);

        if (s.length <= EXCEL_CELL_LIMIT) return s;

        // Dejamos espacio para sufijo
        const suffix = "… (TRUNCADO)";
        const max = EXCEL_CELL_LIMIT - suffix.length;
        return s.slice(0, Math.max(0, max)) + suffix;
    }

    function isIsoDateString(s) {
        if (typeof s !== "string") return false;
        // ISO típico con T o con Z / milisegundos opcionales
        // Ej: 2025-12-06T23:17:42.593Z | 2025-12-06T23:17:42.593 | 2025-12-06
        return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?)?$/.test(s);
    }

    function formatFriendlyDate(value, withTime = true) {
        if (!value) return "";
        const s = String(value);

        if (!isIsoDateString(s)) return s;

        // Si viene solo fecha (YYYY-MM-DD), lo mostramos como fecha sin hora
        const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(s);
        const d = new Date(s);

        if (Number.isNaN(d.getTime())) return s;

        const opts = onlyDate
            ? { year: "numeric", month: "short", day: "2-digit", timeZone: TZ }
            : {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "numeric",
                minute: "2-digit",
                timeZone: TZ,
            };

        // es-CO para que salga “dic”, “ene”, etc.
        return new Intl.DateTimeFormat("es-CO", opts).format(d);
    }


    return (
        <div className="p-4">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Explorador de Datos</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-300">Consulta, filtra y exporta tablas y vistas.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportToExcel}
                        className="bg-krobi text-white px-3 py-2 rounded-md text-sm hover:bg-krobi-dark disabled:opacity-50"
                        disabled={loading}
                    >
                        Exportar a Excel
                    </button>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                        {loading ? "Cargando…" : `Mostrando ${rows.length} de ${total}`}
                    </span>
                </div>
            </header>

            {/* Selector de tabla/vista */}
            <div className="mb-4 grid md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tabla / Vista</label>
                    <select
                        value={tableKey}
                        onChange={(e) => setTableKey(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-3 py-2 text-sm"
                    >
                        {CATALOG.map((g) => (
                            <optgroup key={g.group} label={g.group}>
                                {g.items.map((t) => (
                                    <option key={t.key} value={t.key}>
                                        {t.label} {t.readOnly ? "(lectura)" : ""}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {/* Orden actual */}
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Orden</label>
                        <div className="flex items-center gap-2">
                            <select
                                value={sort.field || ""}
                                onChange={(e) => setSort({ field: e.target.value || null, asc: true })}
                                className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-3 py-2 text-sm"
                            >
                                <option value="">(sin orden)</option>
                                {columns.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setSort((s) => ({ ...s, asc: !s.asc }))}
                                disabled={!sort.field}
                                className="border px-3 py-2 rounded text-sm disabled:opacity-50 dark:border-gray-600 dark:text-white"
                            >
                                {sort.asc ? "Asc" : "Desc"}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => load()}
                        className="self-end border px-3 py-2 rounded text-sm dark:border-gray-600 dark:text-white"
                    >
                        Aplicar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Filtros</span>
                    <button onClick={addFilter} className="text-sm text-krobi hover:underline">+ Agregar filtro</button>
                </div>
                {filters.map((f, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center">
                        <select
                            value={f.field}
                            onChange={(e) => updateFilter(i, "field", e.target.value)}
                            className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">Campo</option>
                            {columns.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={f.op}
                            onChange={(e) => updateFilter(i, "op", e.target.value)}
                            className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                        >
                            {OPERATORS.map((o) => (
                                <option key={o.op} value={o.op}>{o.op}</option>
                            ))}
                        </select>

                        {/* Input de valor: texto, número o rango de fechas */}
                        {f.op === "entre" && isDateField(f.field) ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={Array.isArray(f.value) ? f.value[0] : ""}
                                    onChange={(e) => updateFilter(i, "value", [e.target.value, Array.isArray(f.value) ? f.value[1] : ""])}
                                    className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <span className="text-xs text-gray-500">a</span>
                                <input
                                    type="date"
                                    value={Array.isArray(f.value) ? f.value[1] : ""}
                                    onChange={(e) => updateFilter(i, "value", [Array.isArray(f.value) ? f.value[0] : "", e.target.value])}
                                    className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                        ) : (
                            <input
                                type={isNumericField(f.field) ? "number" : isDateField(f.field) ? "date" : "text"}
                                placeholder="Valor"
                                value={Array.isArray(f.value) ? "" : f.value}
                                onChange={(e) => updateFilter(i, "value", e.target.value)}
                                className="px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                            />
                        )}

                        {i > 0 && (
                            <button onClick={() => removeFilter(i)} className="text-xs text-red-500">Quitar</button>
                        )}
                    </div>
                ))}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-krobi-light dark:bg-gray-900 text-krobi dark:text-white">
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c}
                                    onClick={() => onHeaderClick(c)}
                                    className="px-4 py-2 border-b dark:border-gray-700 text-left cursor-pointer select-none"
                                    title="Ordenar"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>{c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                                        {sort.field === c && <span className="text-xs">{sort.asc ? "▲" : "▼"}</span>}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-6 text-center text-gray-500 dark:text-gray-300"
                                >
                                    <KroBiLoader
                                        message="Cargando magia de KroBi…"
                                        subtext="Consultando Supabase y afinando filtros"
                                        inline={false}
                                    />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-6 text-center text-gray-500 dark:text-gray-300"
                                >
                                    <KroBiNoData
                                        message="No hay resultados para los filtros seleccionados."
                                        subtext="Prueba quitando alguno o usa el botón para limpiar."
                                    />
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, idx) => (
                                <tr
                                    key={idx}
                                    className={
                                        "hover:bg-gray-50 dark:hover:bg-gray-800 " +
                                        (tableKey === "productos" ? "cursor-pointer" : "")
                                    }
                                    onClick={() => {
                                        if (tableKey === "productos") {
                                            openProductEditor(r);
                                        }
                                    }}
                                >
                                    {columns.map((c, i) => (
                                        <td
                                            key={i}
                                            className="px-4 py-2 border-b dark:border-gray-700 dark:text-white align-top"
                                        >
                                            {renderCell(c, r[c])}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>

                </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-center gap-2 mt-4">
                <button
                    disabled={page === 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="text-sm px-3 py-1 border rounded disabled:opacity-50 dark:bg-gray-700 dark:text-white"
                >
                    Anterior
                </button>
                <span className="text-sm dark:text-white">Página {page} de {totalPages}</span>
                <button
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="text-sm px-3 py-1 border rounded disabled:opacity-50 dark:bg-gray-700 dark:text-white"
                >
                    Siguiente
                </button>
            </div>

            {/* Panel lateral JSON amigable */}
            {jsonPanelOpen && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={closeJsonPanel} />
                    <aside className="absolute right-0 top-0 h-full w-full sm:w-[520px] md:w-[700px] lg:w-[860px] bg-white dark:bg-gray-900 shadow-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{jsonPanelTitle}</h2>
                            <button
                                onClick={closeJsonPanel}
                                className="text-sm px-3 py-1 border rounded dark:border-gray-600 dark:text-white"
                            >
                                Cerrar
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700 p-3">
                            {/* 👇 Reemplazo del <pre> por la tabla */}
                            {renderJsonPanelContent(jsonPanelData)}
                        </div>
                    </aside>
                </div>
            )}

            {/* Panel lateral EDICIÓN PRODUCTOS */}
            {tableKey === "productos" && editingProduct && (
                <div className="fixed inset-0 z-40">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setEditingProduct(null)}
                    />
                    <aside className="absolute right-0 top-0 h-full w-full sm:w-[420px] md:w-[520px] bg-white dark:bg-gray-900 shadow-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Editar producto
                            </h2>
                            <button
                                onClick={() => setEditingProduct(null)}
                                className="text-sm px-3 py-1 border rounded dark:border-gray-600 dark:text-white"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="space-y-3 flex-1 overflow-auto">
                            {/* Campos solo lectura de referencia */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Código sistema
                                </label>
                                <input
                                    type="text"
                                    value={editingProduct.codigo_sistema || ""}
                                    readOnly
                                    className="w-full px-2 py-1 rounded border text-sm bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Nombre origen (Siigo)
                                </label>
                                <input
                                    type="text"
                                    value={editingProduct.nombre_origen || ""}
                                    readOnly
                                    className="w-full px-2 py-1 rounded border text-sm bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
                                />
                            </div>

                            {/* Nombre estandarizado */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Nombre estandarizado
                                </label>
                                <input
                                    type="text"
                                    value={editingValues.nombre_estandarizado || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, nombre_estandarizado: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                            </div>

                            {/* Silueta / Referencia (input + datalist) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Silueta / Referencia
                                </label>
                                <input
                                    list="siluetas-list"
                                    value={editingValues.silueta || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, silueta: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="siluetas-list">
                                    {siluetasCatalogo.map((s) => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Género – aquí sí recomiendo <select> fijo por el CHECK de la tabla */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Género
                                </label>
                                <select
                                    value={editingValues.genero || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, genero: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                >
                                    <option value="">(sin género)</option>
                                    <option value="hombre">Hombre</option>
                                    <option value="mujer">Mujer</option>
                                    <option value="niño">Niño</option>
                                    <option value="niña">Niña</option>
                                    <option value="familia">Familia</option>
                                </select>
                            </div>

                            {/* Tipo de prenda */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Tipo de prenda
                                </label>
                                <input
                                    list="tipos-prenda-list"
                                    value={editingValues.tipo_prenda || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, tipo_prenda: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="tipos-prenda-list">
                                    {tiposPrendaCatalogo.map((t) => (
                                        <option key={t} value={t} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Talla */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Talla
                                </label>
                                <input
                                    list="tallas-list"
                                    value={editingValues.talla || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, talla: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="tallas-list">
                                    {tallasCatalogo.map((t) => (
                                        <option key={t} value={t} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Color
                                </label>
                                <input
                                    list="colores-list"
                                    value={editingValues.color || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, color: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="colores-list">
                                    {coloresCatalogo.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Print / estampado */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Print / estampado
                                </label>
                                <input
                                    list="prints-list"
                                    value={editingValues.print || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, print: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="prints-list">
                                    {printsCatalogo.map((p) => (
                                        <option key={p} value={p} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Colección */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Colección
                                </label>
                                <input
                                    list="colecciones-list"
                                    value={editingValues.coleccion || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, coleccion: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                                <datalist id="colecciones-list">
                                    {coleccionesCatalogo.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Homologado */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Homologado (sí/no u observación)
                                </label>
                                <input
                                    type="text"
                                    value={editingValues.homologado || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, homologado: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                            </div>

                            {/* Tipo libre */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                    Tipo (campo libre)
                                </label>
                                <input
                                    type="text"
                                    value={editingValues.tipo || ""}
                                    onChange={(e) =>
                                        setEditingValues((prev) => ({ ...prev, tipo: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                />
                            </div>


                            {/* Campos EDITABLES según schema
                            {[
                                { key: "nombre_estandarizado", label: "Nombre estandarizado" },
                                { key: "silueta", label: "Silueta" },
                                { key: "genero", label: "Género (hombre/mujer/niño/niña/familia)" },
                                { key: "tipo_prenda", label: "Tipo de prenda" },
                                { key: "talla", label: "Talla" },
                                { key: "color", label: "Color" },
                                { key: "print", label: "Print / estampado" },
                                { key: "coleccion", label: "Colección" },
                                { key: "homologado", label: "Homologado (sí/no u observación)" },
                                { key: "tipo", label: "Tipo (campo libre)" },
                            ].map((f) => (
                                <div key={f.key}>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                        {f.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingValues[f.key] || ""}
                                        onChange={(e) =>
                                            setEditingValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                                        }
                                        className="w-full px-2 py-1 rounded border text-sm dark:bg-gray-800 dark:text-white"
                                    />
                                </div>
                            ))} */}
                        </div>

                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => setEditingProduct(null)}
                                className="text-sm px-3 py-1 border rounded dark:border-gray-600 dark:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={editingSaving}
                                onClick={async () => {
                                    try {
                                        setEditingSaving(true);

                                        const payload = {
                                            ...editingValues,
                                            updated_at: new Date().toISOString(),
                                        };

                                        console.log("Guardando producto", editingProduct.id_producto, payload);

                                        const { data, error } = await supabase
                                            .from("productos")
                                            .update(payload)
                                            .eq("id_producto", editingProduct.id_producto)
                                            .select();

                                        console.log("Resultado update productos:", { data, error });

                                        if (error) {
                                            console.error("Error actualizando producto", error);
                                            alert(`Error guardando cambios en el producto: ${error.message}`);
                                            return;
                                        }

                                        if (!data || data.length === 0) {
                                            alert(
                                                "No se actualizó ninguna fila. " +
                                                "Es posible que el registro no cumpla las policies de actualización (RLS) " +
                                                "o que el id_producto no coincida."
                                            );
                                            return;
                                        }

                                        // Actualiza la fila en memoria
                                        setRows((prev) =>
                                            prev.map((r) =>
                                                r.id_producto === data[0].id_producto ? { ...r, ...data[0] } : r
                                            )
                                        );

                                        await load();
                                        setEditingProduct(null);
                                    } finally {
                                        setEditingSaving(false);
                                    }
                                }}
                            >
                                {editingSaving ? "Guardando…" : "Guardar cambios"}
                            </button>



                        </div>
                    </aside>
                </div>
            )}
        </div>
    );

    function renderCell(field, val) {
        if (val === null || val === undefined) return "";

        // items_json / item_json / itemjson: botón para abrir panel si hay datos
        if (isItemJsonField(field)) {
            const parsed = tryParseJson(val);
            const hasData =
                parsed !== null &&
                parsed !== undefined &&
                (!(typeof parsed === "string") || parsed.trim() !== "") &&
                (!Array.isArray(parsed) || parsed.length > 0) &&
                (!(typeof parsed === "object") || Object.keys(parsed).length > 0);

            if (!hasData) return "";
            return (
                <button
                    onClick={() => openJsonPanel(`Detalle "${field}"`, parsed)}
                    className="text-krobi underline text-sm"
                    title="Ver detalle JSON"
                >
                    Ver JSON
                </button>
            );
        }
        function extractPaymentNames(v) {
            const parsed = tryParseJson(v);
            if (Array.isArray(parsed)) {
                const names = parsed.map((x) => x?.name || x?.label || x?.nombre).filter(Boolean);
                if (names.length) return names.join(", ");
            } else if (parsed && typeof parsed === "object") {
                const nm = parsed.name || parsed.label || parsed.nombre;
                if (nm) return nm;
            }
            // fallback: si era string plano (no JSON) lo devolvemos tal cual
            return typeof v === "string" ? v : "";
        }
        // Enlaces tipo URL como icono clickeable
        if (isUrlField(field) && typeof val === "string" && /^https?:\/\//i.test(val)) {
            return (
                <a
                    href={val}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-krobi underline"
                    title="Abrir documento"
                    aria-label="Abrir documento"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM13 9V4.5L18.5 10H14a1 1 0 0 1-1-1z" />
                    </svg>
                    Ver
                </a>
            );
        }

        // Forma/Metodo de pago: mostrar solo `name`
        if (isFormaPagoField(field) || isMetodoPagoField(field)) {
            const name = extractPaymentNames(val);
            return <span className="block truncate">{name}</span>;
        }

        if (typeof val === "object") {
            try {
                return <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(val, null, 2)}</pre>;
            } catch {
                return String(val);
            }
        }
        const s = String(val);

        // Formato amigable si es ISO o si el campo parece fecha
        if (isDateField(field) || isIsoDateString(s)) {
            return formatFriendlyDate(s, true);
        }

        if (/^https?:\/\//i.test(s)) {
            return (
                <a href={s} target="_blank" rel="noreferrer" className="text-krobi underline break-all">
                    {s}
                </a>
            );
        }
        return s;
    }
}
