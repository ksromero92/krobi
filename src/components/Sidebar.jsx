// Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import krobiHi from "../assets/krobi_hi.png";
import IconKrobi from "./IconKrobi";

const menu = [
    { path: "/reportes", label: "Reportes", icon: "📊" },
    { path: "/data", label: "Data", icon: "📁" },
    { path: "/agente", label: "Agente IA", icon: "krobi" },
];

export default function Sidebar({ isExpanded, setIsExpanded }) {
    return (
        <aside
            className={
                "transition-all duration-300 ease-in-out " +
                // En móvil siempre w-16; en >=sm ya sí depende de isExpanded:
                "w-16 " +
                (isExpanded ? "sm:w-60" : "sm:w-20") +
                " bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 " +
                "h-screen p-3 sm:p-5 flex flex-col shadow-sm"
            }
        >
            {/* Encabezado */}
            <div className="flex flex-col gap-4 mb-8">
                {/* Versión móvil: sólo ícono, sin texto ni botón de expandir */}
                <div className="flex items-center justify-center sm:hidden">
                    <NavLink to="/home" className="block">
                        <img
                            src={krobiHi}
                            alt="KroBi logo"
                            className="w-8 h-8 object-contain drop-shadow-sm"
                        />
                    </NavLink>
                </div>

                {/* Versión desktop: igual que antes pero solo visible >= sm */}
                <div className="hidden sm:flex items-center justify-between">
                    {isExpanded ? (
                        <NavLink
                            to="/home"
                            className="flex items-center gap-2 text-2xl font-extrabold text-krobi dark:text-white tracking-wide"
                        >
                            <img
                                src={krobiHi}
                                alt="KroBi logo"
                                className="w-8 h-8 object-contain drop-shadow-sm transition-transform duration-300 ease-in-out"
                            />
                            <span className="hidden sm:inline">KroBi</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/home" className="block">
                            <img
                                src={krobiHi}
                                alt="KroBi logo"
                                className="w-8 h-8 object-contain drop-shadow-sm"
                            />
                        </NavLink>
                    )}

                    {/* Botón de expandir solo en desktop */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden sm:inline-flex focus:outline-none"
                    >
                        <Menu className="w-6 h-6 text-krobi dark:text-white" />
                    </button>
                </div>
            </div>

            {/* Navegación */}
            <nav className="flex flex-col gap-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                {menu.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            [
                                "flex items-center py-2 rounded-lg transition",
                                // En móvil centrado, sólo ícono. En desktop, texto + padding:
                                "justify-center sm:justify-start",
                                isExpanded ? "sm:gap-2 sm:px-3" : "sm:justify-center",
                                isActive
                                    ? "bg-krobi text-white shadow"
                                    : "hover:bg-krobi-light hover:text-krobi dark:hover:bg-gray-800 dark:hover:text-white",
                            ].join(" ")
                        }
                    >
                        {item.icon === "krobi" ? (
                            <IconKrobi size={20} />
                        ) : (
                            <span>{item.icon}</span>
                        )}
                        {/* El texto solo se ve cuando está expandido y en >= sm */}
                        {isExpanded && (
                            <span className="hidden sm:inline">{item.label}</span>
                        )}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
