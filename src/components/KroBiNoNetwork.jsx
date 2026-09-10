import React from "react";
import { motion } from "framer-motion";
// Ajusta la ruta si no usas alias @
import noNetImg from "@/assets/krobinored.png";

/**
 * KroBiNoNetwork — Estado de error de red (offline / request fallida)
 *
 * Props:
 * - message?: string
 * - subtext?: string
 * - inline?: boolean (true: compacto)
 * - onRetry?: () => void (muestra botón si existe)
 * - actionLabel?: string (texto del botón)
 */
export default function KroBiNoNetwork({
    message = "¿Sin red? KroBi quedó partido a la mitad…",
    subtext = "Revisa tu conexión o inténtalo de nuevo en unos segundos.",
    inline = false,
    onRetry,
    actionLabel = "Reintentar",
}) {
    return (
        <section
            role="status"
            aria-live="polite"
            className={[
                "w-full",
                "flex flex-col items-center justify-center text-center",
                "rounded-2xl border",
                "border-dashed border-slate-200 dark:border-slate-700",
                "bg-white/60 dark:bg-slate-900/40",
                inline ? "p-6" : "py-16 px-8",
            ].join(" ")}
        >
            {/* Imagen con animación tipo "alerta/glitch" */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
            >
                <motion.img
                    src={noNetImg}
                    alt="KroBi sin red"
                    draggable={false}
                    className="w-24 h-24 md:w-28 md:h-28 select-none pointer-events-none"
                    animate={{
                        x: [0, -3, 3, 0],
                        rotate: [0, -3, 3, 0],
                        filter: [
                            "drop-shadow(0 0 0 rgba(0,0,0,0.0))",
                            "drop-shadow(0 0 6px rgba(3,166,136,0.35))",
                            "drop-shadow(0 0 0 rgba(0,0,0,0.0))",
                        ],
                    }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
            </motion.div>

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

            {onRetry && (
                <motion.button
                    type="button"
                    onClick={onRetry}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white bg-[#03A688] hover:bg-[#02886F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#03A688] dark:focus:ring-offset-slate-900 shadow-sm"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.08 }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-90">
                        <path d="M12 6v3m0 6v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {actionLabel}
                </motion.button>
            )}
        </section>
    );
}
