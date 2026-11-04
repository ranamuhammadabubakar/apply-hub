import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Institutions from './pages/Institutions';
import Recommendations from './pages/Recommendations';
import Applications from './pages/Applications';
import Admin from './pages/Admin';
import Counseling from './pages/Counseling';
import Quiz from './pages/Quiz';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const BRAND = '#4338CA'; // Royal Indigo, the one theme colour
const DISPLAY_FONT = { fontFamily: 'var(--font-heading)' };

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

const navLinkClass = ({ isActive }) =>
  `block px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
    isActive ? 'bg-[#EEF2FF] text-[#4338CA]' : 'text-gray-600 hover:text-[#4338CA] hover:bg-gray-50'
  }`;

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false); // mobile and tablet menu
  const [accountOpen, setAccountOpen] = useState(false); // account dropdown
  const accountRef = useRef(null);

  // Close menus when the page changes
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  // Close the account menu when clicking anywhere else
  useEffect(() => {
    function onClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // After logging out, go to the homepage instead of the login page
  function handleLogout() {
    navigate('/', { replace: true });
    logout();
  }

  const mainLinks = [
    { to: '/institutions', label: 'Universities' },
    ...(user
      ? [
          { to: '/recommendations', label: 'My matches' },
          { to: '/quiz', label: 'Career quiz' },
          { to: '/counseling', label: 'Ask AI' },
          { to: '/applications', label: 'Applications' },
          { to: '/profile', label: 'Profile' },
        ]
      : []),
  ];

  const accountLinks = user?.role === 'admin' ? [{ to: '/admin', label: 'Admin panel' }] : [];

  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-[#E0E7FF] sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link to="/" className="text-xl font-bold shrink-0" style={{ ...DISPLAY_FONT, color: BRAND }}>
          Apply Hub
        </Link>

        {/* Desktop links (large screens only, so they never wrap onto two lines) */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
          {mainLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="relative hidden lg:block" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span
                  className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center"
                  style={{ background: BRAND }}
                >
                  {initial}
                </span>
                <span className="text-sm font-medium text-gray-700 max-w-28 truncate">{user.name}</span>
              </button>
              {accountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-white border border-[#E0E7FF] rounded-md shadow-lg py-1">
                  {accountLinks.map((l) => (
                    <Link key={l.to} to={l.to} role="menuitem" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      {l.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className={`block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 ${
                      accountLinks.length ? 'border-t border-gray-100' : ''
                    }`}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden lg:inline-block text-white text-sm font-semibold px-4 py-2 rounded-md"
              style={{ background: BRAND }}
            >
              Log in
            </Link>
          )}

          {/* Menu button for mobile and tablet */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="lg:hidden w-10 h-10 rounded-md flex items-center justify-center text-2xl hover:bg-gray-50"
            style={{ color: BRAND }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile and tablet menu */}
      {menuOpen && (
        <nav className="lg:hidden border-t border-[#E0E7FF] px-4 py-3 space-y-1 bg-white" aria-label="Mobile">
          {mainLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <p className="px-3 pt-3 text-xs text-gray-500">Signed in as {user.name}</p>
              {accountLinks.map((l) => (
                <NavLink key={l.to} to={l.to} className={navLinkClass}>
                  {l.label}
                </NavLink>
              ))}
              <button type="button" onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm font-medium text-red-600">
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navLinkClass}>
              Log in
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
}

export default function App() {
  const location = useLocation();
  // The homepage controls its own full-width layout; other pages use the standard container
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-gray-900">
      <Navbar />
      <main className={isHome ? '' : 'max-w-5xl mx-auto px-4 py-6'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/recommendations" element={<Protected><Recommendations /></Protected>} />
          <Route path="/applications" element={<Protected><Applications /></Protected>} />
          <Route path="/counseling" element={<Protected><Counseling /></Protected>} />
          <Route path="/quiz" element={<Protected><Quiz /></Protected>} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>
    </div>
  );
}