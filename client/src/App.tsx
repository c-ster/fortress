import { useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { IntakePage } from './pages/IntakePage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './stores/auth';

function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-fortress-navy text-white px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link to="/" className="hover:opacity-90">
          <h1 className="text-xl font-bold tracking-tight">Fortress</h1>
          <p className="text-sm text-gray-300">Financial Readiness Platform</p>
        </Link>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-300 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function App() {
  const refreshSession = useAuthStore((s) => s.refreshSession);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route
            path="/"
            element={
              <div className="text-center py-16">
                <h2 className="text-3xl font-bold text-fortress-navy mb-4">
                  Your Financial Stability Moat
                </h2>
                <p className="text-gray-600 max-w-md mx-auto mb-8">
                  Secure financial planning for service members and their families. Get to 80%
                  financial readiness in under 30 minutes.
                </p>
                <Link
                  to="/intake"
                  className="bg-fortress-navy text-white px-8 py-3 rounded-md font-medium
                    hover:bg-fortress-navy/90 transition-colors inline-block"
                >
                  Start Financial Intake
                </Link>
              </div>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/intake"
            element={
              <ProtectedRoute>
                <IntakePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
