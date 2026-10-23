import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Institutions from './pages/Institutions';
import Recommendations from './pages/Recommendations';
import Applications from './pages/Applications';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-indigo-700 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
        <Link to="/" className="font-bold text-lg">Apply Hub</Link>
        <Link to="/institutions">Institutions</Link>
        {user && <Link to="/recommendations">Recommendations</Link>}
        {user && <Link to="/applications">My Applications</Link>}
        {user && <Link to="/profile">Profile</Link>}
        <span className="ml-auto" />
        {user ? (
          <button onClick={logout} className="bg-white/20 px-3 py-1 rounded">
            Logout ({user.name})
          </button>
        ) : (
          <Link to="/login" className="bg-white text-indigo-700 px-3 py-1 rounded">Login</Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/recommendations" element={<Protected><Recommendations /></Protected>} />
          <Route path="/applications" element={<Protected><Applications /></Protected>} />
          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </main>
    </div>
  );
}