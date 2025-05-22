import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import InputPage from './Pages/InputPage';
import Login from './Pages/login';
import AnalyzePage from './Pages/AnalyzeEnhanced';
import SimpleAnalyze from './Pages/SimpleAnalyze';
import AuthTest from './Pages/AuthTest';
import AdminLogin from './Pages/AdminLogin';
import AdminDashboard from './Pages/AdminDashboard';

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, isAdmin, user } = useAuth();
  console.log('ProtectedRoute:', { isAuthenticated, loading, isAdmin, user });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }
  
  // If admin only route and not admin, redirect to home
  if (adminOnly && !isAdmin) {
    console.log('Admin access required, redirecting to home');
    return <Navigate to="/" replace />;
  }
  
  // If we have children, render them, otherwise render Outlet for nested routes
  return children ? children : <Outlet />;
};

function AppContent() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin">
          <Route path="login" element={<AdminLogin />} />
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route index element={<Navigate to="login" replace />} />
        </Route>
        <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<InputPage />} />
          <Route path="/analyze/:owner/:repo" element={<AnalyzePage />} />
          <Route path="/simple-analyze/:owner/:repo" element={<SimpleAnalyze />} />
        </Route>
        
        {/* Test route for GitHub OAuth */}
        <Route path="/auth-test" element={<AuthTest />} />
        
        {/* GitHub OAuth callback route */}
        <Route path="/auth/github/callback" element={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            backgroundColor: '#0f172a',
            color: 'white',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h2>Completing GitHub login...</h2>
            <p>Please wait while we authenticate your account.</p>
          </div>
        } />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;