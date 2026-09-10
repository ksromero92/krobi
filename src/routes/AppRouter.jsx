// import { createBrowserRouter, RouterProvider } from "react-router-dom";
// import LayoutPrincipal from "../layouts/LayoutPrincipal";
// import Home from "../pages/Home";
// import ReportesAuto from "../pages/ReportesAuto";
// import Data from "../pages/Data";
// import AgenteIA from "../pages/AgenteIA";
// import Login from "../pages/Login";
// import RequireAuth from "./RequireAuth";

// const router = createBrowserRouter([
//     {
//         path: "/login",
//         element: <Login />,
//     },
//     {
//         path: "/",
//         element: (
//             <RequireAuth>
//                 <LayoutPrincipal />
//             </RequireAuth>
//         ),
//         children: [
//             { path: "/", element: <Home /> },
//             { path: "/reportes", element: <ReportesAuto /> },
//             { path: "/data", element: <Data /> },
//             { path: "/agente", element: <AgenteIA /> },
//         ],
//     },
// ]);

// export default function AppRouter() {
//     return <RouterProvider router={router} />;
// }



import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LayoutPrincipal from "../layouts/LayoutPrincipal";
import Home from "../pages/Home";
import ReportesAuto from "../pages/ReportesAuto";
import DataAuto from "../pages/DataAuto";
import AgenteIA from "../pages/AgenteIA";
import Login from "../pages/Login";
import RequireAuth from "./RequireAuth";

// NUEVA landing pública
import PublicHome from "../pages/PublicHome";

const router = createBrowserRouter([
    // 🔓 Landing pública (SEO, Google, visitantes)
    {
        path: "/",
        element: <PublicHome />,
    },

    // 🔑 Login
    {
        path: "/login",
        element: <Login />,
    },

    // 🔒 Zona autenticada (dashboard + módulos)
    {
        path: "/",
        element: (
            <RequireAuth>
                <LayoutPrincipal />
            </RequireAuth>
        ),
        children: [
            // Home interna después de loguearse: ahora en /home
            { path: "home", element: <Home /> },

            // Rutas protegidas (siguen siendo /reportes, /data, /agente)
            { path: "reportes", element: <ReportesAuto /> },
            { path: "data", element: <DataAuto /> },
            { path: "agente", element: <AgenteIA /> },
        ],
    },
]);

export default function AppRouter() {
    return <RouterProvider router={router} />;
}
