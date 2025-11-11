import "./styles/variables.css";
import "./styles/globals.css";
import { Route, Routes } from "react-router-dom";
import CategoriesOverviewScreen from "./components/layouts/CategoriesOverviewScreen/CategoriesOverviewScreen.tsx";
import LoaderScreen from "./components/layouts/LoderScreen/LoderScreen.tsx";
import OverviewScreen from "./components/layouts/OverviewScreen/OverviewScreen.tsx";
import ReportScreen from "./components/layouts/ReportScreen/ReportScreen.tsx";
import { ApiService } from "./services/Api.service.ts";
import { IndexDBService } from "./services/indexDB.service.ts";
import { LoggerService } from "./services/Logger.service.ts";
import { PresentationService } from "./services/Presentation.service.ts";

function App() {
  const api = new ApiService();
  const logger = new LoggerService();
  const presentation = new PresentationService();
  const db = new IndexDBService();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <CategoriesOverviewScreen logger={logger} presentation={presentation} api={api} db={db} />
        }
      />
      <Route
        path="/changelog-overview"
        element={<OverviewScreen logger={logger} presentation={presentation} api={api} db={db} />}
      />
      <Route path="/report-dialog" element={<ReportScreen logger={logger} api={api} db={db} />} />
      <Route path="/loader" element={<LoaderScreen />} />
    </Routes>
  );
}

export default App;
