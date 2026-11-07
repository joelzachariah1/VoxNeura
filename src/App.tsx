import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { FeaturesProvider } from './context/FeaturesContext.tsx'
import { DataPage } from './pages/DataPage.tsx'
import { ExperimentsPage } from './pages/ExperimentsPage.tsx'
import { FiguresPage } from './pages/FiguresPage.tsx'
import { InterfacePage } from './pages/InterfacePage.tsx'
import { MissingPage } from './pages/MissingPage.tsx'
import { OverviewPage } from './pages/OverviewPage.tsx'
import { ReliabilityPage } from './pages/ReliabilityPage.tsx'
import { ResearchPage } from './pages/ResearchPage.tsx'

export default function App() {
  return (
    <FeaturesProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="figures" element={<FiguresPage />} />
            <Route path="reliability" element={<ReliabilityPage />} />
            <Route path="interface" element={<InterfacePage />} />
            <Route path="experiments" element={<ExperimentsPage />} />
            <Route path="research" element={<ResearchPage />} />
            <Route path="*" element={<MissingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FeaturesProvider>
  )
}
