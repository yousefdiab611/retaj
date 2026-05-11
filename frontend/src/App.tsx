import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute } from "@/components/AdminRoute";
import { ManagerRoute } from "@/components/ManagerRoute";
import { OfflineSyncDaemon } from "@/components/OfflineSyncDaemon";
import { ProtectedLicenseRoute } from "@/components/ProtectedLicenseRoute";
import { SetupGate } from "@/components/SetupGate";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { isLicensingEnabled } from "@/lib/electron";
import { AdminCustomersPage } from "@/pages/AdminCustomersPage";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminLicensesPage } from "@/pages/AdminLicensesPage";
import { AdminLogsPage } from "@/pages/AdminLogsPage";
import { AdminProductsPage } from "@/pages/AdminProductsPage";
import { BranchesPage } from "@/pages/BranchesPage";
import { CustomerPortalPage } from "@/pages/CustomerPortalPage";
import { LicenseActivationPage } from "@/pages/LicenseActivationPage";
import { LoginPage } from "@/pages/LoginPage";
import { POSPage } from "@/pages/POSPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SetupPage } from "@/pages/SetupPage";
import { TenantsPage } from "@/pages/TenantsPage";

export default function App() {
  return (
    <HashRouter>
      <SetupGate>
        <OfflineSyncDaemon />
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
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
          <Route
            path="/license"
            element={isLicensingEnabled() ? <LicenseActivationPage /> : <Navigate to="/pos" replace />}
          />
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
      </SetupGate>
    </HashRouter>
  );
}
