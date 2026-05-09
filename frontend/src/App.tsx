import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute } from "@/components/AdminRoute";
import { ManagerRoute } from "@/components/ManagerRoute";
import { OfflineSyncDaemon } from "@/components/OfflineSyncDaemon";
import { ProtectedLicenseRoute } from "@/components/ProtectedLicenseRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { AdminProductsPage } from "@/pages/AdminProductsPage";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminLicensesPage } from "@/pages/AdminLicensesPage";
import { AdminCustomersPage } from "@/pages/AdminCustomersPage";
import { AdminLogsPage } from "@/pages/AdminLogsPage";
import { BranchesPage } from "@/pages/BranchesPage";
import { CustomerPortalPage } from "@/pages/CustomerPortalPage";
import { LicenseActivationPage } from "@/pages/LicenseActivationPage";
import { LoginPage } from "@/pages/LoginPage";
import { POSPage } from "@/pages/POSPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { TenantsPage } from "@/pages/TenantsPage";

export default function App() {
  return (
    <BrowserRouter>
      <OfflineSyncDaemon />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/pos"
          element={
            <ProtectedLicenseRoute>
              <POSPage />
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedLicenseRoute>
              <ReportsPage />
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedLicenseRoute>
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/licenses"
          element={
            <ProtectedLicenseRoute>
              <AdminRoute>
                <AdminLicensesPage />
              </AdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <ProtectedLicenseRoute>
              <AdminRoute>
                <AdminCustomersPage />
              </AdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedLicenseRoute>
              <AdminRoute>
                <AdminLogsPage />
              </AdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedLicenseRoute>
              <ManagerRoute>
                <AdminProductsPage />
              </ManagerRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/branches"
          element={
            <ProtectedLicenseRoute>
              <AdminRoute>
                <BranchesPage />
              </AdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <ProtectedLicenseRoute>
              <SuperAdminRoute>
                <TenantsPage />
              </SuperAdminRoute>
            </ProtectedLicenseRoute>
          }
        />
        <Route path="/license" element={<LicenseActivationPage />} />
        <Route
          path="/customer"
          element={
            <ProtectedLicenseRoute>
              <CustomerPortalPage />
            </ProtectedLicenseRoute>
          }
        />
        <Route path="/" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
