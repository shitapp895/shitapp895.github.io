import { Outlet, Navigate } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import OnlineUsers from '../components/OnlineUsersNew';
import GameModal from '../components/GameModal';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <Outlet />
          </div>

          <div className="md:col-span-1">
            <OnlineUsers />
          </div>
        </div>
      </main>

      <Footer />
      
      {/* Centralized Game Modal */}
      <GameModal />
    </div>
  );
};

export default MainLayout;
