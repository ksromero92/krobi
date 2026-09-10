// src/hooks/useStickyParam.js
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

export function useStickyParam(key, defaultValue) {
    const [params, setParams] = useSearchParams();
    const { pathname } = useLocation();
    const lsKey = useMemo(() => `krobi:${pathname}:${key}`, [pathname, key]);

    // inicial: URL > localStorage > default
    const initial = useMemo(() => {
        const fromURL = params.get(key);
        if (fromURL) return fromURL;
        const fromLS = localStorage.getItem(lsKey);
        return fromLS ?? defaultValue;
    }, [params, lsKey, defaultValue]);

    const [value, setValue] = useState(initial);

    // Sincroniza cuando cambie el value: URL (replace) + localStorage
    useEffect(() => {
        const next = new URLSearchParams(params);
        if (value === defaultValue || value == null) next.delete(key);
        else next.set(key, value);
        setParams(next, { replace: true });
        localStorage.setItem(lsKey, value);
    }, [value, key, defaultValue, lsKey, params, setParams]);

    // Si el usuario vuelve con el botón “atrás” y cambió el query param
    useEffect(() => {
        const fromURL = params.get(key);
        if ((fromURL ?? defaultValue) !== value) {
            setValue(fromURL ?? defaultValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]); // importante: depende del string

    return [value, setValue];
}
