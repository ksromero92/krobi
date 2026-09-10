// src/pages/PublicHome.jsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

// Textos en ES / EN
const STRINGS = {
    es: {
        navQueEs: "Qué es KroBi",
        navBeneficios: "Beneficios",
        navPrecios: "Planes",
        navClientes: "Clientes",
        navLogin: "Login",

        heroBadge: "Plataforma SaaS para análisis de datos",
        heroTitlePart1: "Monitoreo de datos y ",
        heroTitleHighlight: "dashboards inteligentes",
        heroTitlePart2: " para tu empresa.",
        heroText:
            "KroBi unifica información operativa, comercial y de facturación desde cualquier sistema con APIs (ERP, facturación electrónica, e-commerce, POS y más). Toma decisiones rápidas con dashboards automáticos y un agente de IA conectado a tu data.",
        heroPrimaryBtn: "Iniciar sesión",
        heroSecondaryBtn: "Ver beneficios →",
        heroTagLine:
            "Datos centralizados • Automatización • IA aplicada al negocio",

        whatIsTitle: "¿Qué es KroBi?",
        whatIsText1:
            "KroBi es una plataforma de inteligencia de negocios para organizaciones con facturación electrónica o sistemas transaccionales. Unifica datos desde múltiples fuentes en una vista clara y actualizada.",
        whatIsText2:
            "Incluye dashboards automáticos, reportes personalizables y un agente de IA que responde preguntas sobre tus datos reales.",
        whatIsCard1Title: "01 · Integración de datos",
        whatIsCard1Text:
            "Sistemas de facturación electrónica, ERP, e-commerce y más (por ejemplo Siigo, Alegra o Shopify), consolidados en una sola base limpia.",
        whatIsCard2Title: "02 · Dashboards inteligentes",
        whatIsCard2Text:
            "KPIs claros por sede, canal, productos, clientes, tiempo y más.",
        whatIsCard3Title: "03 · IA sobre tu negocio",
        whatIsCard3Text:
            "Pregunta en lenguaje natural (“¿cómo vamos este mes?”) y recibe respuestas inmediatas.",

        benefitsTitle: "Beneficios para tu operación",
        benefitsCard1Title: "Menos Excel, más claridad",
        benefitsCard1Text:
            "KroBi actualiza tus tableros automáticamente según la frecuencia definida.",
        benefitsCard2Title: "Decisiones en tiempo real",
        benefitsCard2Text:
            "Visualiza puntos fuertes, productos ganadores, rotación y tendencias.",
        benefitsCard3Title: "Acompañamiento experto",
        benefitsCard3Text:
            "Implementación guiada, soporte y mejoras continuas.",

        // PLANES / PRECIOS
        pricingTitle: "Planes y precios",
        pricingSubtitle:
            "Elige el plan que mejor se adapta a tus instancias/sedes. Puedes pagar mes a mes o anual con un ahorro equivalente a 2 meses.",

        pricingBasicName: "Plan Básico",
        pricingBasicBestFor:
            "Para instancias pequeñas o una sola sede.",
        pricingBasicMonthly: "Mensual: $600.000 COP",
        pricingBasicYearly: "Anual: $6.000.000 COP",
        pricingBasicFeaturesTitle: "Incluye:",
        pricingBasicFeature1: "1 instancia/sede",
        pricingBasicFeature2: "Integración API simple",
        pricingBasicFeature3: "Dashboards esenciales",
        pricingBasicFeature4: "IA básica (consultas simples)",
        pricingBasicFeature5: "1 usuario",
        pricingBasicFeature6: "Soporte 1 hora mensual",

        pricingProName: "Plan Pro",
        pricingProBestFor:
            "Para varias instancias/sedes y mayor nivel de análisis.",
        pricingProMonthly: "Mensual: $1.200.000 COP",
        pricingProYearly: "Anual: $12.000.000 COP",
        pricingProFeaturesTitle: "Incluye:",
        pricingProFeature1: "Hasta 3 instancias/sedes",
        pricingProFeature2: "Integraciones API múltiples",
        pricingProFeature3:
            "Dashboards avanzados y reportes personalizables",
        pricingProFeature4: "IA completa",
        pricingProFeature5: "Automatizaciones con n8n",
        pricingProFeature6: "Soporte 3 horas mensuales",

        pricingEntName: "Plan Enterprise",
        pricingEntBestFor:
            "Para organizaciones grandes, multiinstancia o alto volumen de datos.",
        pricingEntMonthly: "Mensual: $2.400.000 COP",
        pricingEntYearly: "Anual: $24.000.000 COP",
        pricingEntFeaturesTitle: "Incluye:",
        pricingEntFeature1: "Instancias/sedes ilimitadas",
        pricingEntFeature2:
            "Integración total con APIs de los sistemas del cliente",
        pricingEntFeature3:
            "Dashboards y modelos de datos a la medida",
        pricingEntFeature4: "IA + RAG y análisis profundo",
        pricingEntFeature5: "Usuarios ilimitados",
        pricingEntFeature6: "Automatizaciones extendidas",
        pricingEntFeature7: "Soporte prioritario",

        pricingCtaDemo: "Solicitar demo",
        pricingCtaContactMail:
            "mailto:contacto@krodev.com?subject=Quiero%20una%20demo%20de%20KroBi",

        // IMPLEMENTACIÓN
        implTitle: "Implementación (pago único)",
        implSubtitle:
            "$8.000.000 – $12.000.000 COP (según volumen de datos y cantidad de sistemas a integrar).",
        implIncludesTitle: "Incluye:",
        implItem1: "Integración API con los sistemas actuales.",
        implItem2: "Ingesta histórica de información.",
        implItem3: "Transformación y limpieza de datos.",
        implItem4: "Homologación y validación de estructuras.",
        implItem5: "Automatización de procesos con n8n.",
        implItem6: "Configuración de IA y embeddings.",
        implItem7: "Ajustes, pruebas y salida a producción.",

        clientsTitle: "Clientes que ya confían en KroBi",
        clientsText:
            "KroBi ha sido implementado para empresas del sector retail como Agua María, unificando ventas de tiendas físicas, canales digitales e inventarios.",
        clientsCaseLabel: "Caso de uso",
        clientsCaseText:
            "Dashboards por tienda, canal, producto y colección, actualizados automáticamente desde sus sistemas de facturación y comercio electrónico.",
        clientsImplementedBy: "Implementado por",

        heroCardTitle: "Datos consolidados (demo 12 meses)",
        heroCardBadge: "Demo KroBi",
        heroCardTotal: "$ 1.248M",
        heroCardDiff: "+18% vs. período anterior",
        heroCardPhysical: "Canal físico",
        heroCardPhysicalValue: "$ 820M",
        heroCardPhysicalGrowth: "↑ 11% crecimiento",
        heroCardEcom: "Canales digitales",
        heroCardEcomValue: "$ 428M",
        heroCardEcomGrowth: "↑ 26% crecimiento",
        heroCardAgentTitle: "Agente IA KroBi",
        heroCardQuestion:
            "“¿Cuáles fueron los 5 productos más vendidos en julio?”",
        heroCardAnswer:
            "Respuestas claras sobre tus datos reales, listas para exportar.",
        heroCardIntegration:
            "Ejemplo: integración con sistemas de facturación y e-commerce.",

        footerRights: "Todos los derechos reservados.",
        footerDevelopedBy: "Desarrollado por",
    },
    en: {
        navQueEs: "What is KroBi",
        navBeneficios: "Benefits",
        navPrecios: "Plans",
        navClientes: "Clients",
        navLogin: "Login",

        heroBadge: "SaaS platform for data analytics",
        heroTitlePart1: "Operational monitoring and ",
        heroTitleHighlight: "smart dashboards",
        heroTitlePart2: " for your business.",
        heroText:
            "KroBi unifies operational, commercial and billing information from any system with APIs (ERP, e-invoicing, e-commerce, POS and more). Make faster decisions with automated dashboards and an AI agent connected to your data.",
        heroPrimaryBtn: "Log in",
        heroSecondaryBtn: "See benefits →",
        heroTagLine:
            "Centralized data • Automation • AI applied to your business",

        whatIsTitle: "What is KroBi?",
        whatIsText1:
            "KroBi is a business intelligence platform for organizations with electronic invoicing or transactional systems. It unifies data from multiple sources into a clear and always up-to-date view.",
        whatIsText2:
            "It includes automated dashboards, customizable reports and an AI agent that answers questions about your real data.",
        whatIsCard1Title: "01 · Data integration",
        whatIsCard1Text:
            "E-invoicing systems, ERPs, e-commerce and more (for example Siigo, Alegra or Shopify), consolidated into a single clean database.",
        whatIsCard2Title: "02 · Smart dashboards",
        whatIsCard2Text:
            "Clear KPIs by location, channel, products, customers, time and more.",
        whatIsCard3Title: "03 · AI for your business",
        whatIsCard3Text:
            "Ask in natural language (“How are we doing this month?”) and get instant answers.",

        benefitsTitle: "Benefits for your operation",
        benefitsCard1Title: "Less Excel, more clarity",
        benefitsCard1Text:
            "KroBi keeps your dashboards updated automatically at the defined frequency.",
        benefitsCard2Title: "Real-time decisions",
        benefitsCard2Text:
            "See strong locations, best-selling products, rotation and trends.",
        benefitsCard3Title: "Expert support",
        benefitsCard3Text:
            "Guided implementation, support and continuous improvements.",

        // PRICING
        pricingTitle: "Plans and pricing",
        pricingSubtitle:
            "Choose the plan that best fits your instances/locations. Pay month-to-month or yearly and save the equivalent of 2 months.",

        pricingBasicName: "Basic Plan",
        pricingBasicBestFor:
            "For small instances or a single location.",
        pricingBasicMonthly: "Monthly: $600,000 COP",
        pricingBasicYearly: "Yearly: $6,000,000 COP",
        pricingBasicFeaturesTitle: "Includes:",
        pricingBasicFeature1: "1 instance/location",
        pricingBasicFeature2: "Simple API integration",
        pricingBasicFeature3: "Essential dashboards",
        pricingBasicFeature4: "Basic AI (simple queries)",
        pricingBasicFeature5: "1 user",
        pricingBasicFeature6: "1 hour of support per month",

        pricingProName: "Pro Plan",
        pricingProBestFor:
            "For several instances/locations and deeper analytics.",
        pricingProMonthly: "Monthly: $1,200,000 COP",
        pricingProYearly: "Yearly: $12,000,000 COP",
        pricingProFeaturesTitle: "Includes:",
        pricingProFeature1: "Up to 3 instances/locations",
        pricingProFeature2: "Multiple API integrations",
        pricingProFeature3:
            "Advanced dashboards and customizable reports",
        pricingProFeature4: "Full AI capabilities",
        pricingProFeature5: "Automations with n8n",
        pricingProFeature6: "3 hours of support per month",

        pricingEntName: "Enterprise Plan",
        pricingEntBestFor:
            "For large organizations, multi-instance or high data volume.",
        pricingEntMonthly: "Monthly: $2,400,000 COP",
        pricingEntYearly: "Yearly: $24,000,000 COP",
        pricingEntFeaturesTitle: "Includes:",
        pricingEntFeature1: "Unlimited instances/locations",
        pricingEntFeature2:
            "Full integration with the client's APIs",
        pricingEntFeature3:
            "Tailor-made dashboards and data models",
        pricingEntFeature4: "AI + RAG and deep analysis",
        pricingEntFeature5: "Unlimited users",
        pricingEntFeature6: "Extended automations",
        pricingEntFeature7: "Priority support",

        pricingCtaDemo: "Request a demo",
        pricingCtaContactMail:
            "mailto:contacto@krodev.com?subject=I%20want%20a%20KroBi%20demo",

        // IMPLEMENTATION
        implTitle: "Implementation (one-time payment)",
        implSubtitle:
            "$8,000,000 – $12,000,000 COP (depending on data volume and number of systems to integrate).",
        implIncludesTitle: "Includes:",
        implItem1: "API integration with current systems.",
        implItem2: "Historical data ingestion.",
        implItem3: "Data transformation and cleaning.",
        implItem4: "Structure homologation and validation.",
        implItem5: "Process automation with n8n.",
        implItem6: "AI and embeddings configuration.",
        implItem7: "Adjustments, testing and go-live.",

        clientsTitle: "Clients already trusting KroBi",
        clientsText:
            "KroBi has been implemented for retail brands such as Agua María, unifying sales from physical stores, digital channels and inventory.",
        clientsCaseLabel: "Use case",
        clientsCaseText:
            "Dashboards by store, channel, product and collection, automatically updated from their billing and e-commerce systems.",
        clientsImplementedBy: "Implemented by",

        heroCardTitle: "Consolidated data (12-month demo)",
        heroCardBadge: "KroBi demo",
        heroCardTotal: "$ 1.248M",
        heroCardDiff: "+18% vs previous period",
        heroCardPhysical: "Physical channel",
        heroCardPhysicalValue: "$ 820M",
        heroCardPhysicalGrowth: "↑ 11% growth",
        heroCardEcom: "Digital channels",
        heroCardEcomValue: "$ 428M",
        heroCardEcomGrowth: "↑ 26% growth",
        heroCardAgentTitle: "KroBi AI Agent",
        heroCardQuestion:
            "“Which were the 5 best-selling products in July?”",
        heroCardAnswer:
            "Clear answers over your real data, ready to export.",
        heroCardIntegration:
            "Example: integration with billing and e-commerce systems.",

        footerRights: "All rights reserved.",
        footerDevelopedBy: "Developed by",
    },
};

export default function PublicHome() {
    const [jumpLogo, setJumpLogo] = useState(false);
    const [theme, setTheme] = useState("light");
    const [lang, setLang] = useState("es");

    const t = STRINGS[lang];

    // Animación del logo solo en móvil
    useEffect(() => {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (isMobile) {
            setJumpLogo(true);
            const timer = setTimeout(() => setJumpLogo(false), 1200);
            return () => clearTimeout(timer);
        }
    }, []);

    // Inicializar tema
    useEffect(() => {
        const stored = localStorage.getItem("theme");
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

        const initialTheme =
            stored === "dark" || (!stored && prefersDark) ? "dark" : "light";

        setTheme(initialTheme);
        if (initialTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, []);

    // Inicializar idioma
    useEffect(() => {
        const storedLang = localStorage.getItem("lang");
        if (storedLang === "es" || storedLang === "en") {
            setLang(storedLang);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("theme", newTheme);
    };

    const changeLang = (newLang) => {
        setLang(newLang);
        localStorage.setItem("lang", newLang);
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col dark:bg-slate-950 dark:text-slate-100">
            {/* HEADER */}
            <header className="border-b border-slate-200 dark:border-slate-800">
                <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* LOGO */}
                    <div className="flex flex-col items-center gap-1 md:flex-row md:items-center md:gap-2">
                        <img
                            src="/logo-krobi.png"
                            alt="KroBi"
                            className={`h-9 w-9 rounded-xl ${jumpLogo ? "animate-bounce" : ""
                                }`}
                        />
                        <span className="font-semibold text-lg tracking-tight text-[#03A688]">
                            KroBi
                        </span>
                    </div>

                    {/* NAV + CONTROLES */}
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4 sm:justify-end">
                        <nav className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm">
                            <a
                                href="#que-es"
                                className="hover:text-[#03A688] text-slate-700 dark:text-slate-200 dark:hover:text-[#03A688]"
                            >
                                {t.navQueEs}
                            </a>
                            <a
                                href="#beneficios"
                                className="hover:text-[#03A688] text-slate-700 dark:text-slate-200 dark:hover:text-[#03A688]"
                            >
                                {t.navBeneficios}
                            </a>
                            <a
                                href="#precios"
                                className="hover:text-[#03A688] text-slate-700 dark:text-slate-200 dark:hover:text-[#03A688]"
                            >
                                {t.navPrecios}
                            </a>
                            <a
                                href="#clientes"
                                className="hover:text-[#03A688] text-slate-700 dark:text-slate-200 dark:hover:text-[#03A688]"
                            >
                                {t.navClientes}
                            </a>
                            <Link
                                to="/login"
                                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border border-[#03A688] text-[#03A688] dark:text-white bg-transparent dark:bg-transparent hover:bg-[#03A688] hover:text-white dark:hover:bg-[#03A688] dark:hover:text-white transition"
                            >
                                {t.navLogin}
                            </Link>
                        </nav>

                        {/* idioma + tema */}
                        <div className="flex items-center gap-2">
                            <div className="flex rounded-full border border-slate-200 dark:border-slate-700 text-[11px] overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => changeLang("es")}
                                    className={`px-2 py-1 ${lang === "es"
                                            ? "bg-[#03A688] text-white"
                                            : "bg-transparent text-slate-600 dark:text-slate-300"
                                        }`}
                                >
                                    ES
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeLang("en")}
                                    className={`px-2 py-1 ${lang === "en"
                                            ? "bg-[#03A688] text-white"
                                            : "bg-transparent text-slate-600 dark:text-slate-300"
                                        }`}
                                >
                                    EN
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="text-xs px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200"
                            >
                                {theme === "light" ? "🌙" : "☀️"}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN */}
            <main className="flex-1">
                {/* HERO */}
                <section className="bg-slate-50 dark:bg-slate-900">
                    <div className="mx-auto max-w-6xl px-4 py-16 grid gap-10 md:grid-cols-2 items-center">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#03A688] mb-3">
                                {t.heroBadge}
                            </p>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                                {t.heroTitlePart1}
                                <span className="text-[#03A688]">
                                    {t.heroTitleHighlight}
                                </span>
                                {t.heroTitlePart2}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm md:text-base max-w-xl">
                                {t.heroText}
                            </p>

                            <div className="flex flex-wrap gap-3 items-center">
                                <Link
                                    to="/login"
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#03A688] text-white shadow-sm hover:bg-[#02886F] transition"
                                >
                                    {t.heroPrimaryBtn}
                                </Link>
                                <a
                                    href="#beneficios"
                                    className="text-sm text-slate-700 hover:text-[#03A688] dark:text-slate-200 dark:hover:text-[#03A688]"
                                >
                                    {t.heroSecondaryBtn}
                                </a>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {t.heroTagLine}
                            </div>
                        </div>

                        {/* Card demo */}
                        <div className="relative">
                            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4 md:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {t.heroCardTitle}
                                    </span>
                                    <span className="text-[10px] px-2 py-1 rounded-full bg-[#E0F7F3] text-[#03A688]">
                                        {t.heroCardBadge}
                                    </span>
                                </div>
                                <p className="text-2xl font-semibold mb-1">
                                    {t.heroCardTotal}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    {t.heroCardDiff}
                                </p>

                                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
                                        <p className="text-slate-500 dark:text-slate-400 mb-1">
                                            {t.heroCardPhysical}
                                        </p>
                                        <p className="font-semibold">
                                            {t.heroCardPhysicalValue}
                                        </p>
                                        <p className="text-[11px] text-emerald-600">
                                            {t.heroCardPhysicalGrowth}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
                                        <p className="text-slate-500 dark:text-slate-400 mb-1">
                                            {t.heroCardEcom}
                                        </p>
                                        <p className="font-semibold">
                                            {t.heroCardEcomValue}
                                        </p>
                                        <p className="text-[11px] text-emerald-600">
                                            {t.heroCardEcomGrowth}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
                                    <p className="text-slate-500 dark:text-slate-400 mb-2">
                                        {t.heroCardAgentTitle}
                                    </p>
                                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2 mb-2">
                                        <p className="text-[11px] text-slate-700 dark:text-slate-200">
                                            {t.heroCardQuestion}
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-[#03A688]/5 p-2">
                                        <p className="text-[11px] text-slate-800 dark:text-slate-100">
                                            {t.heroCardAnswer}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -bottom-5 -left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md rounded-2xl px-3 py-2 text-[11px] flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                <span className="text-slate-700 dark:text-slate-200">
                                    {t.heroCardIntegration}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ¿QUÉ ES KROBI? */}
                <section
                    id="que-es"
                    className="py-12 md:py-16 bg-white dark:bg-slate-950"
                >
                    <div className="mx-auto max-w-6xl px-4 grid gap-10 md:grid-cols-2 items-start">
                        <div>
                            <h2 className="text-xl md:text-2xl font-semibold mb-3">
                                <span className="text-[#03A688]">
                                    {t.whatIsTitle}
                                </span>
                            </h2>
                            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-4">
                                {t.whatIsText1}
                            </p>
                            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-4">
                                {t.whatIsText2}
                            </p>
                        </div>

                        <div className="grid gap-4">
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.whatIsCard1Title}
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                    {t.whatIsCard1Text}
                                </p>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.whatIsCard2Title}
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                    {t.whatIsCard2Text}
                                </p>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.whatIsCard3Title}
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                    {t.whatIsCard3Text}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* BENEFICIOS */}
                <section
                    id="beneficios"
                    className="py-12 md:py-16 bg-slate-50 dark:bg-slate-900"
                >
                    <div className="mx-auto max-w-6xl px-4">
                        <h2 className="text-xl md:text-2xl font-semibold mb-6">
                            {t.benefitsTitle}
                        </h2>
                        <div className="grid gap-5 md:grid-cols-3 text-sm">
                            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-4">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.benefitsCard1Title}
                                </p>
                                <p className="text-slate-700 dark:text-slate-200">
                                    {t.benefitsCard1Text}
                                </p>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-4">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.benefitsCard2Title}
                                </p>
                                <p className="text-slate-700 dark:text-slate-200">
                                    {t.benefitsCard2Text}
                                </p>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-4">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.benefitsCard3Title}
                                </p>
                                <p className="text-slate-700 dark:text-slate-200">
                                    {t.benefitsCard3Text}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PLANES / PRECIOS */}
                <section
                    id="precios"
                    className="py-12 md:py-16 bg-white dark:bg-slate-950"
                >
                    <div className="mx-auto max-w-6xl px-4">
                        <h2 className="text-xl md:text-2xl font-semibold mb-3">
                            {t.pricingTitle}
                        </h2>
                        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-8 max-w-2xl">
                            {t.pricingSubtitle}
                        </p>

                        <div className="grid gap-6 md:grid-cols-3 text-sm">
                            {/* BASIC */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50/60 dark:bg-slate-900 flex flex-col">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.pricingBasicBestFor}
                                </p>
                                <h3 className="text-lg font-semibold mb-2 text-[#03A688]">
                                    {t.pricingBasicName}
                                </h3>
                                <p className="text-sm font-medium mb-1">
                                    {t.pricingBasicMonthly}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    {t.pricingBasicYearly}
                                </p>
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-2">
                                    {t.pricingBasicFeaturesTitle}
                                </p>
                                <ul className="list-disc pl-4 text-xs text-slate-700 dark:text-slate-200 mb-6 space-y-1">
                                    <li>{t.pricingBasicFeature1}</li>
                                    <li>{t.pricingBasicFeature2}</li>
                                    <li>{t.pricingBasicFeature3}</li>
                                    <li>{t.pricingBasicFeature4}</li>
                                    <li>{t.pricingBasicFeature5}</li>
                                    <li>{t.pricingBasicFeature6}</li>
                                </ul>
                                <a
                                    href={t.pricingCtaContactMail}
                                    className="mt-auto inline-flex justify-center items-center px-4 py-2 rounded-xl text-xs font-medium bg-[#03A688] text-white hover:bg-[#02886F] transition"
                                >
                                    {t.pricingCtaDemo}
                                </a>
                            </div>

                            {/* PRO */}
                            <div className="border-2 border-[#03A688] rounded-2xl p-5 bg-[#E0F7F3] dark:bg-slate-900/70 flex flex-col shadow-sm">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                    {t.pricingProBestFor}
                                </p>
                                <h3 className="text-lg font-semibold mb-2 text-[#03A688]">
                                    {t.pricingProName}
                                </h3>
                                <p className="text-sm font-medium mb-1">
                                    {t.pricingProMonthly}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                                    {t.pricingProYearly}
                                </p>
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-100 mb-2">
                                    {t.pricingProFeaturesTitle}
                                </p>
                                <ul className="list-disc pl-4 text-xs text-slate-800 dark:text-slate-100 mb-6 space-y-1">
                                    <li>{t.pricingProFeature1}</li>
                                    <li>{t.pricingProFeature2}</li>
                                    <li>{t.pricingProFeature3}</li>
                                    <li>{t.pricingProFeature4}</li>
                                    <li>{t.pricingProFeature5}</li>
                                    <li>{t.pricingProFeature6}</li>
                                </ul>
                                <a
                                    href={t.pricingCtaContactMail}
                                    className="mt-auto inline-flex justify-center items-center px-4 py-2 rounded-xl text-xs font-medium bg-[#03A688] text-white hover:bg-[#02886F] transition"
                                >
                                    {t.pricingCtaDemo}
                                </a>
                            </div>

                            {/* ENTERPRISE */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50/60 dark:bg-slate-900 flex flex-col">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.pricingEntBestFor}
                                </p>
                                <h3 className="text-lg font-semibold mb-2 text-[#03A688]">
                                    {t.pricingEntName}
                                </h3>
                                <p className="text-sm font-medium mb-1">
                                    {t.pricingEntMonthly}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    {t.pricingEntYearly}
                                </p>
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-2">
                                    {t.pricingEntFeaturesTitle}
                                </p>
                                <ul className="list-disc pl-4 text-xs text-slate-700 dark:text-slate-200 mb-6 space-y-1">
                                    <li>{t.pricingEntFeature1}</li>
                                    <li>{t.pricingEntFeature2}</li>
                                    <li>{t.pricingEntFeature3}</li>
                                    <li>{t.pricingEntFeature4}</li>
                                    <li>{t.pricingEntFeature5}</li>
                                    <li>{t.pricingEntFeature6}</li>
                                    <li>{t.pricingEntFeature7}</li>
                                </ul>
                                <a
                                    href={t.pricingCtaContactMail}
                                    className="mt-auto inline-flex justify-center items-center px-4 py-2 rounded-xl text-xs font-medium bg-[#03A688] text-white hover:bg-[#02886F] transition"
                                >
                                    {t.pricingCtaDemo}
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* IMPLEMENTACIÓN (PAGO ÚNICO) */}
                <section className="py-10 md:py-14 bg-slate-50 dark:bg-slate-900">
                    <div className="mx-auto max-w-6xl px-4">
                        <h2 className="text-xl md:text-2xl font-semibold mb-3 text-[#03A688]">
                            {t.implTitle}
                        </h2>
                        <p className="text-sm md:text-base text-slate-700 dark:text-slate-200 mb-4">
                            {t.implSubtitle}
                        </p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                            {t.implIncludesTitle}
                        </p>
                        <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                            <li>{t.implItem1}</li>
                            <li>{t.implItem2}</li>
                            <li>{t.implItem3}</li>
                            <li>{t.implItem4}</li>
                            <li>{t.implItem5}</li>
                            <li>{t.implItem6}</li>
                            <li>{t.implItem7}</li>
                        </ul>
                    </div>
                </section>

                {/* CLIENTES */}
                <section
                    id="clientes"
                    className="py-12 md:py-16 bg-white dark:bg-slate-950"
                >
                    <div className="mx-auto max-w-6xl px-4">
                        <h2 className="text-xl md:text-2xl font-semibold mb-4">
                            {t.clientsTitle}
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            {t.clientsText}
                        </p>

                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                    {t.clientsCaseLabel}
                                </p>
                                <p className="text-sm text-slate-800 dark:text-slate-200">
                                    {t.clientsCaseText}
                                </p>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {t.clientsImplementedBy}{" "}
                                <a
                                    href="https://www.krodev.com/"
                                    className="hover:text-[#03A688] dark:hover:text-[#03A688]"
                                >
                                    Krodev
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* FOOTER */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                        © {new Date().getFullYear()} KroBi. {t.footerRights}
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
                        <span>
                            {t.footerDevelopedBy}{" "}
                            <a
                                href="https://www.krodev.com/"
                                className="hover:text-[#03A688] dark:hover:text-[#03A688]"
                            >
                                Krodev
                            </a>
                        </span>
                        <a
                            href="mailto:contacto@krodev.com"
                            className="hover:text-[#03A688] dark:hover:text-[#03A688]"
                        >
                            contacto@krodev.com
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
