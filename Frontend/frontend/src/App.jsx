import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import SessionManager from './components/SessionManager';

import Login from './pages/Login';
import AddProduct from './pages/AddProduct';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Forecasts from './pages/Forecasts';
import Reports from './pages/Reports';
import Navbar from './components/Navbar';
import UserManagement from './pages/UserManagement';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-xl">Loading Dropex System...</div>;

  if (!user) return <Navigate to="/login" />;

  if (roles && !user.isAdmin && !roles.includes(user.role)) {
    if (user.role === 'sales_manager') return <Navigate to="/sales" />;
    if (user.role === 'forecast_manager') return <Navigate to="/forecasts" />;
    if (user.role === 'report_analyst') return <Navigate to="/reports" />;
    if (user.role === 'product_manager') return <Navigate to="/products/add" />;
    return <Navigate to="/inventory" />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  let defaultRoute = "/inventory";
  if (user && !user.isAdmin) {
    if (user.role === 'sales_manager') defaultRoute = "/sales";
    if (user.role === 'forecast_manager') defaultRoute = "/forecasts";
    if (user.role === 'report_analyst') defaultRoute = "/reports";
    if (user.role === 'product_manager') defaultRoute = "/products/add";
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#050508' }}>
        {user && <Navbar />}
        <main className="flex-1 w-full m-0 p-0">
          <SessionManager>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/products/add" element={<PrivateRoute roles={['product_manager']}><AddProduct /></PrivateRoute>} />
              <Route path="/sales" element={<PrivateRoute roles={['sales_manager']}><Sales /></PrivateRoute>} />
              <Route path="/inventory" element={<PrivateRoute roles={['inventory_manager']}><Inventory /></PrivateRoute>} />
              <Route path="/forecasts" element={<PrivateRoute roles={['forecast_manager']}><Forecasts /></PrivateRoute>} />
              <Route path="/reports" element={<PrivateRoute roles={['report_analyst']}><Reports /></PrivateRoute>} />
              <Route path="/users" element={<PrivateRoute roles={['admin']}><UserManagement /></PrivateRoute>} />
              <Route path="/" element={<Navigate to={defaultRoute} />} />
            </Routes>
          </SessionManager>
        </main>
      </div>
    </Router>
  );
}
