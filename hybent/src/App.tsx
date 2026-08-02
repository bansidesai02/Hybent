import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import PlatformPage from './pages/PlatformPage'
import AiCapabilitiesPage from './pages/AiCapabilitiesPage'
import SolutionsPage from './pages/SolutionsPage'
import IndustriesPage from './pages/IndustriesPage'
import SecurityPage from './pages/SecurityPage'
import CustomersPage from './pages/CustomersPage'
import AboutPage from './pages/AboutPage'
import ResourcesPage from './pages/ResourcesPage'
import CareersPage from './pages/CareersPage'
import ContactPage from './pages/ContactPage'
import PrivacyPage from './pages/PrivacyPage'

/* The optional second segment is a deep link to a section inside the view
   (/products/roadmap, /platform/ecosystem, /about/timeline) — Layout scrolls
   to the element with that id once the view is rendered. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products/:section?" element={<ProductsPage />} />
        <Route path="/platform/:section?" element={<PlatformPage />} />
        <Route path="/ai/:section?" element={<AiCapabilitiesPage />} />
        <Route path="/solutions/:section?" element={<SolutionsPage />} />
        <Route path="/industries/:section?" element={<IndustriesPage />} />
        <Route path="/security/:section?" element={<SecurityPage />} />
        <Route path="/customers/:section?" element={<CustomersPage />} />
        <Route path="/about/:section?" element={<AboutPage />} />
        <Route path="/resources/:section?" element={<ResourcesPage />} />
        <Route path="/careers/:section?" element={<CareersPage />} />
        <Route path="/contact/:section?" element={<ContactPage />} />
        <Route path="/privacy/:section?" element={<PrivacyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
