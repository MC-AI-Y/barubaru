import "@/styles/globals.css";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { WHControlApp } from "@/app/_screens/WHControlApp";
createRoot(document.getElementById("root")!).render(<StrictMode><WHControlApp /></StrictMode>);
