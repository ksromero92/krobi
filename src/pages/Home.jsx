import { useNavigate } from "react-router-dom";

const modules = [
    { title: "Reportes", desc: "Consulta ventas, KPIs y análisis visual", route: "/reportes" },
    { title: "Data", desc: "Explora y crea tus propios reportes", route: "/data" },
    { title: "Agente IA", desc: "Habla con KroBi y consulta datos por voz o texto", route: "/agente" },
];

export default function Home() {
    const navigate = useNavigate();

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Bienvenido a KroBi</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {modules.map((m) => (
                    <div
                        key={m.title}
                        onClick={() => navigate(m.route)}
                        className="cursor-pointer border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:border-krobi group transform hover:scale-[1.02]"
                    >
                        <h2 className="text-xl font-bold text-krobi group-hover:text-krobi-dark mb-2">{m.title}</h2>
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-snug">{m.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
