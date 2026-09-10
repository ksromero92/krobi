const kpis = [
    { label: "Ventas del mes", value: "$12.450.000" },
    { label: "Nº Facturas", value: "235" },
    { label: "Clientes únicos", value: "178" },
    { label: "Ticket promedio", value: "$53.000" },
];

export default function Dashboard() {
    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard de Ventas</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, idx) => (
                    <div
                        key={idx}
                        className="bg-white shadow rounded-xl p-5 border border-gray-200"
                    >
                        <h2 className="text-sm text-gray-500">{kpi.label}</h2>
                        <p className="text-2xl font-semibold text-blue-600">{kpi.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
