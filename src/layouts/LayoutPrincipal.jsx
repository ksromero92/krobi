import { useState, Fragment, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import useDarkMode from "../hooks/useDarkMode";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthProvider";
import { useIsMobile } from "@/hooks/useIsMobile";


function TopbarUser() {
    const { user, profile, session, loading } = useAuth();

    if (loading) {
        return (
            <div className="w-28 h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        );
    }
    if (!session) return null;

    return (
        <div className="text-right text-xs sm:text-sm leading-tight">
            {/* <div className="font-semibold">{profile?.nombre ?? "Usuario"}</div> */}
            <div className="opacity-70">{user?.email}</div>
        </div>
    );
}


export default function LayoutPrincipal() {
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDark, setIsDark] = useDarkMode();
    const [showChangePassModal, setShowChangePassModal] = useState(false);

    const { signOut, changePassword } = useAuth();
    const isMobile = useIsMobile(768);

    // refs para el modal de contraseña
    const newRef = useRef(null);
    const confirmRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [ok, setOk] = useState("");

    return (
        <div className="flex h-screen w-full overflow-x-hidden bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 transition-colors duration-300">
            <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />

            <div className="flex-1 flex flex-col">
                {/* Topbar */}
                <header className="h-14 px-4 sm:px-6 flex justify-between items-center border-b shadow-sm bg-white dark:bg-gray-900 dark:border-gray-700">
                    <button
                        onClick={() => navigate("/home")}
                        className="text-xs sm:text-sm text-krobi hover:text-krobi-dark dark:hover:text-white transition font-medium"
                    >
                        Ir al inicio
                    </button>

                    {/* Right side: usuario + menú */}
                    <div className="flex items-center gap-4">


                        <Menu as="div" className="relative">
                            <Menu.Button className="flex items-center gap-2 text-krobi hover:text-krobi-dark dark:text-white dark:hover:text-gray-300 transition focus:outline-none">
                                {/* En móvil no repetimos el correo aquí para que no se desborde */}
                                <span className="hidden sm:inline text-sm font-medium">
                                    <TopbarUser />
                                </span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-6 h-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0H4.5z"
                                    />
                                </svg>
                            </Menu.Button>

                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-600 rounded-md shadow-lg focus:outline-none z-10">
                                    <div className="px-1 py-1">
                                        <Menu.Item as="div">
                                            {({ active }) => (
                                                <button
                                                    onClick={() => setIsDark(!isDark)}
                                                    className={`${active ? 'bg-krobi-light text-krobi dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                                >
                                                    {isDark ? "☀️ Modo claro" : "🌙 Modo oscuro"}
                                                </button>
                                            )}
                                        </Menu.Item>

                                        <Menu.Item as="div">
                                            {({ active }) => (
                                                <button
                                                    onClick={() => setShowChangePassModal(true)}
                                                    className={`${active ? 'bg-krobi-light text-krobi dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                                                        } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                                                >
                                                    🔐 Cambiar contraseña
                                                </button>
                                            )}
                                        </Menu.Item>

                                        <Menu.Item as="div">
                                            {({ active }) => (
                                                <button
                                                    onClick={async () => {
                                                        await signOut();
                                                        window.location.href = "/login";
                                                    }}
                                                    className={`${active ? 'bg-krobi-light text-krobi dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                                                        } group flex w/full items-center rounded-md px-2 py-2 text-sm`}
                                                >
                                                    🚪 Cerrar sesión
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </header>

                {/* Contenido */}
                <main
                    className="flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-950 transition-colors duration-300"
                >
                    <Outlet />
                </main>
            </div>

            <Modal
                show={showChangePassModal}
                onClose={() => {
                    setErr(""); setOk("");
                    setShowChangePassModal(false);
                }}
                title="Cambiar contraseña"
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setErr(""); setOk("");

                        const newPass = newRef.current?.value || "";
                        const confirm = confirmRef.current?.value || "";

                        if (!newPass || newPass.length < 8) {
                            setErr("La nueva contraseña debe tener al menos 8 caracteres");
                            return;
                        }
                        if (newPass !== confirm) {
                            setErr("La confirmación no coincide");
                            return;
                        }

                        try {
                            setSaving(true);
                            await changePassword(newPass);
                            setOk("¡Contraseña actualizada!");
                            if (newRef.current) newRef.current.value = "";
                            if (confirmRef.current) confirmRef.current.value = "";
                            setTimeout(() => {
                                setShowChangePassModal(false);
                            }, 900);
                        } catch (e) {
                            setErr(e?.message ?? "No fue posible actualizar la contraseña");
                        } finally {
                            setSaving(false);
                        }
                    }}
                >
                    {err && <p className="text-red-500 text-sm mb-2">{err}</p>}
                    {ok && <p className="text-green-600 text-sm mb-2">{ok}</p>}

                    {/* No es necesario pedir la actual si la sesión está activa */}
                    <input
                        ref={newRef}
                        type="password"
                        placeholder="Nueva contraseña"
                        className="w-full mb-3 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                    />
                    <input
                        ref={confirmRef}
                        type="password"
                        placeholder="Confirmar nueva contraseña"
                        className="w-full mb-4 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-krobi text-white py-2 rounded-md hover:bg-krobi-dark transition disabled:opacity-60"
                    >
                        {saving ? "Guardando..." : "Cambiar contraseña"}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
