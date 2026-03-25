import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Navbar.css';

export default function Navbar() {
    const { logout, user } = useAuth();
    const loc = useLocation();

    // Helper to determine if a route is active
    const isActive = (path) => loc.pathname.startsWith(path) ? ' active' : '';

    return (
        <nav>
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
                <div className="logo">
                    <div className="logo-hex" />
                    <div className="logo-text">DROPEX<span>.AI</span></div>
                </div>

                {/* Dynamically render links based on RBAC logic like original Navbar */}
                <div className="nav-links">
                    {(user?.isAdmin || user?.role === 'inventory_manager') && (
                        <Link to="/inventory" className={`nav-link${isActive('/inventory')}`}>Inventory Alerts</Link>
                    )}

                    {(user?.isAdmin || user?.role === 'forecast_manager') && (
                        <Link to="/forecasts" className={`nav-link${isActive('/forecasts')}`}>Forecasts</Link>
                    )}

                    {(user?.isAdmin || user?.role === 'sales_manager') && (
                        <Link to="/sales" className={`nav-link${isActive('/sales')}`}>Record Sales</Link>
                    )}

                    {(user?.isAdmin || user?.role === 'product_manager') && (
                        <Link to="/products/add" className={`nav-link${isActive('/products')}`}>Add Product</Link>
                    )}

                    {(user?.isAdmin || user?.role === 'report_analyst') && (
                        <Link to="/reports" className={`nav-link${isActive('/reports')}`}>Reports</Link>
                    )}

                    {user?.isAdmin && (
                        <Link to="/users" className={`nav-link${isActive('/users')}`}>Users</Link>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span className="nav-email">{user?.email}</span>
                <button onClick={logout} className="logout-btn">LOGOUT</button>
            </div>
        </nav>
    );
}
