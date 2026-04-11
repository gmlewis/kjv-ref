import { ProphetApp } from "@prophet/client/react";
import { createRoot } from "react-dom/client";
import { __schemas, __defaults, __entityDefaults } from "../kjv-memorize";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ProphetApp schemas={__schemas} defaults={__defaults} entityDefaults={__entityDefaults}>
    <App />
  </ProphetApp>
);
