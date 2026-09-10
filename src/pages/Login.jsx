import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
import Modal from "../components/Modal";
import krobiLogo from "../assets/krobi_login.png";
import { useAuth } from "../context/AuthProvider";

export default function Login() {
    const navigate = useNavigate();
    const [isDark] = useDarkMode();
    const { signIn, session } = useAuth();

    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");
    const [showRecoverModal, setShowRecoverModal] = useState(false);

    useEffect(() => {
        if (session) navigate("/home");
    }, [session, navigate]);

    const handleLogin = async () => {
        try {
            setError("");
            await signIn(user, pass);
            navigate("/home");
        } catch (e) {
            setError(e?.message ?? "Usuario o contraseña incorrectos");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
            <div className="absolute top-1/2 -translate-y-[220px] z-0 flex justify-center w-full">
                <img
                    src={krobiLogo}
                    alt="KroBi logo"
                    className="w-36 object-contain drop-shadow-xl animate-fade-in"
                />
            </div>

            <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-8 w-full max-w-sm shadow-2xl">
                <h1 className="text-3xl font-extrabold text-krobi text-center animate-fade-in mb-6 tracking-widest">
                    KroBi
                </h1>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <input
                    type="email"
                    placeholder="Correo"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full mb-3 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full mb-4 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                />

                <button
                    onClick={handleLogin}
                    className="w-full bg-krobi text-white py-2 rounded-md hover:bg-krobi-dark transition"
                >
                    Ingresar
                </button>

                {/* Recuperar contraseña */}
                <button
                    onClick={() => setShowRecoverModal(true)}
                    className="mt-3 text-sm text-krobi hover:underline block mx-auto"
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </div>

            <Modal
                show={showRecoverModal}
                onClose={() => setShowRecoverModal(false)}
                title="¿Olvidaste tu contraseña?"
            >
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    Comunícate con el administrador para restablecer tu acceso.<br />
                    Puedes escribir a <span className="font-medium text-krobi">kevin@krodev.com</span>
                </p>
            </Modal>
        </div>
    );
}
