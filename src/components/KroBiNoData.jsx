// src/components/KroBiNoData.jsx
import React from "react";
import { motion } from "framer-motion";

// ✅ Usa la que tengas disponible:
// - Si tienes alias "@":  import noDataImg from "@/assets/krobinodata.png";
// - Si no tienes alias:   usa la ruta relativa:
import noDataImg from "../assets/krobinodata.png";

/**
 * KroBiNoData — Estado vacío divertido y coherente con KroBiLoader
 *
 * Props:
 * - message?: string      (título)
 * - subtext?: string      (descripción)
 * - inline?: boolean      (true: compacto para cards)
 * - onResetFilters?: fn   (muestra botón si se pasa)
 * - actionLabel?: string  (texto del botón)
 */
export default function KroBiNoData({
    message = "No hay resultados para los filtros seleccionados.",
    subtext = "Ajusta o limpia filtros e inténtalo de nuevo.",
    inline = false,
    onResetFilters,
    actionLabel = "Limpiar filtros",
}) {
    return (
        <section
            aria-live="polite"
            className={[
                "w-full",
                "flex flex-col items-center justify-center text-center",
                "rounded-2xl border border-dashed",
                "bg-white/60 dark:bg-slate-900/40",
                "border-slate-200 dark:border-slate-700",
                inline ? "p-6" : "py-14 px-8",
            ].join(" ")}
        >
            {/* Imagen con movimiento sutil */}
            <motion.img
                src={noDataImg}
                alt="KroBi confundido: sin resultados"
                draggable={false}
                initial={{ y: 0, rotate: 0, scale: 0.98, opacity: 0.95 }}
                animate={{ y: [0, -6, 0], rotate: [0, 2, -2, 0], scale: [0.98, 1, 0.98] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 md:w-28 md:h-28 select-none pointer-events-none"
            />

            <motion.h3
                className="mt-4 text-base md:text-lg font-semibold text-slate-700 dark:text-slate-200"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
            >
                {message}
            </motion.h3>

            <motion.p
                className="mt-2 text-xs md:text-sm text-gray-500 dark:text-gray-400"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
            >
                {subtext}
            </motion.p>

            {onResetFilters && (
                <motion.button
                    type="button"
                    onClick={onResetFilters}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white bg-[#03A688] hover:bg-[#02886F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#03A688] dark:focus:ring-offset-slate-900 shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.08 }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90">
                        <path d="M3 6h18M7 6l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {actionLabel}
                </motion.button>
            )}
        </section>
    );
}
