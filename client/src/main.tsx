import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App";
import "./index.css";

document.body.classList.add("font-sans", "antialiased");

createRoot(document.getElementById("root")!).render(<App />);
