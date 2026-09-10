import React from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import Reportes from "@/pages/Reportes"; // vista completa (desktop)
import ReportesMobileLite from "@/pages/ReportesMobileLite";

export default function ReportesAuto() {
    const isMobile = useIsMobile(768);
    return isMobile ? <ReportesMobileLite /> : <Reportes />;
}
