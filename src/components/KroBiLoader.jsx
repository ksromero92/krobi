import React from "react";
import krobiHi from "../assets/krobi_hi.png"; // ajusta el alias si no usas @

/**
 * KroBiLoader
 * props:
 * - message?: string (texto principal)
 * - subtext?: string (texto secundario)
 * - inline?: boolean (si true, usa tamaño compacto)
 */
export default function KroBiLoader({
    message = "Cargando datos...",
    subtext = "Acomodando las tablas y sacando KPIs 🛠️",
    inline = false,
}) {
    return (
        <div
            className={[
                "w-full flex items-center justify-center",
                inline ? "py-6" : "py-16",
            ].join(" ")}
            role="status"
            aria-live="polite"
        >
            <div className="flex flex-col items-center gap-4">
                {/* Imagen con rebote sutil */}
                <div className="relative">
                    <img
                        src={krobiHi}
                        alt="KroBi cargando"
                        className={[
                            "h-24 w-auto select-none pointer-events-none",
                            "animate-bounce",
                            inline ? "h-16" : "h-24",
                        ].join(" ")}
                        draggable="false"
                    />
                    {/* Sombrita que late debajo */}
                    <div
                        className={[
                            "absolute left-1/2 -translate-x-1/2",
                            inline ? "w-14 h-2 -bottom-1" : "w-20 h-3 -bottom-2",
                            "rounded-full opacity-40 blur-[2px]",
                            "bg-emerald-600/40 dark:bg-emerald-400/30",
                            "animate-pulse",
                        ].join(" ")}
                    />
                </div>

                {/* Mensajes */}
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {message}
                        <span className="sr-only"> (cargando)</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {subtext}
                    </p>
                </div>

                {/* Dots animados */}
                <div className="flex items-center gap-2 mt-1" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <span
                            key={i}
                            className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
