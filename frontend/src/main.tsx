import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { CandleFeedProvider } from "./contexts/CandleFeedContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <CandleFeedProvider>
        <App />
      </CandleFeedProvider>
    </AuthProvider>
  </React.StrictMode>
);
