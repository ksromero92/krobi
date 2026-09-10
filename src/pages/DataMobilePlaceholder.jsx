// src/pages/DataMobilePlaceholder.jsx
import React from "react";
import krobiLaptop from "@/assets/krobi_laptop.png"; // ⬅️ Ajusta la ruta si lo necesitas

export default function DataMobilePlaceholder() {
    return (
        <div className="min-h-[100svh] flex flex-col items-center justify-center px-6
                        bg-white dark:bg-gray-900 text-center">

            {/* Imagen */}
            <img
                src={krobiLaptop}
                alt="KroBi laptop"
                className="w-48 h-auto mb-6 opacity-90 dark:opacity-100
                           drop-shadow-md select-none pointer-events-none"
            />

            {/* Título */}
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                Módulo disponible solo en versión web de escritorio
            </h1>

            {/* Texto */}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                El módulo <span className="font-semibold">Data</span> está optimizado para
                pantallas grandes, ya que requiere más área de visualización
                para trabajar con tablas, filtros avanzados y reportes personalizados.
            </p>

            {/* Nota inferior */}
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px]">
                Por favor ingresa desde un computador para acceder a todas
                las funciones del Módulo Data.
            </p>
        </div>
    );
}
