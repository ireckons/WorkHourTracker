import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
    const { isAuthenticated, user, isAdmin, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/dashboard" className="navbar-logo">
                    <span className="logo-icon">⏱</span>
                    <span className="logo-text">WorkHourTracker</span>
                </Link>
            </div>

            <div className="navbar-actions">
                {isAuthenticated ? (
                    <>
                        {isAdmin && (
                            <Link to="/admin-dashboard" className="btn btn-ghost admin-nav-link">
                                🛡️ Admin
                            </Link>
                        )}
                        <Link to="/dashboard" className="btn btn-ghost">
                            Dashboard
                        </Link>
                        <span className="navbar-user">
                            <span className="user-avatar">{user?.name?.[0]?.toUpperCase()}</span>
                            {user?.name}
                            {isAdmin && <span className="admin-badge-small">Admin</span>}
                        </span>
                        <button onClick={handleLogout} className="btn btn-ghost">
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="btn btn-ghost">Login</Link>
                        <Link to="/register" className="btn btn-primary">Sign Up</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
