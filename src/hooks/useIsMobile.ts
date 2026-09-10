import { useEffect, useState } from "react";

export function useIsMobile(breakpointPx = 768) {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.innerWidth < breakpointPx;
    });

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, [breakpointPx]);

    return isMobile;
}
