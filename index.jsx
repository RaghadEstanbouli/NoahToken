import React from "react";
import ReactDOM from "react-dom/client";
import TokenTrackerApp from "./App";
import "./index.css"; // optional, can remove if no CSS file

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <TokenTrackerApp />
  </React.StrictMode>
);