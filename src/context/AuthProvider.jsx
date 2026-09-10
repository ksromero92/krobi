import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from '@/lib/supabaseClient';

const AuthCtx = createContext(null);
const supabase = getSupabase();

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null); // fila de public.usuarios
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Cargar sesión actual
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session ?? null);
            setUser(data.session?.user ?? null);
        });

        // Suscribirse a cambios de auth
        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
            setSession(sess);
            setUser(sess?.user ?? null);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        async function loadProfile() {
            if (!user) {
                setProfile(null);
                setLoading(false);
                return;
            }
            // Traer perfil desde tu tabla espejo (public.usuarios)
            const { data, error } = await supabase
                .from("usuarios")
                .select("*")
                .eq("id_usuario", user.id)
                .maybeSingle();
            if (!error) setProfile(data || null);
            setLoading(false);
        }
        setLoading(true);
        loadProfile();
    }, [user]);

    // Helpers
    async function signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    }

    async function signOut() {
        await supabase.auth.signOut();
    }

    async function changePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }

    return (
        <AuthCtx.Provider value={{ session, user, profile, loading, signIn, signOut, changePassword }}>
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth() {
    return useContext(AuthCtx);
}
