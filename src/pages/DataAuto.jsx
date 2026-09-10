// src/pages/DataAuto.jsx
import React from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import Data from "@/pages/Data"; // tu módulo completo de Data (desktop)
import DataMobilePlaceholder from "@/pages/DataMobilePlaceholder";

export default function DataAuto() {
    const isMobile = useIsMobile(768);
    return isMobile ? <DataMobilePlaceholder /> : <Data />;
}
