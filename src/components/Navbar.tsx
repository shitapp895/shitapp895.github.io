import { FaToilet, FaUser, FaUserFriends, FaSignOutAlt, FaTwitter, FaBriefcase } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { userData, logout, updateUserStatus } = useAuth();

  const handleShitToggle = () => {
    if (userData) {
      updateUserStatus(!userData.isShitting);
    }
  };

  return (
    <nav className="bg-white dark:bg-slate-800 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2">
            <FaToilet className="text-primary text-2xl" />
            <span className="text-xl font-bold">ShitApp</span>
          </Link>

          <div className="flex items-center space-x-6">
            <button
              onClick={handleShitToggle}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                userData?.isShitting ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-slate-700'
              }`}
            >
              <FaToilet />
              <span>{userData?.isShitting ? 'Shitting' : 'Not Shitting'}</span>
            </button>

            <div className="flex items-center space-x-4">
              <Link to="/friends" className="text-gray-600 dark:text-gray-300 hover:text-primary">
                <FaUserFriends className="text-xl" />
              </Link>

              <Link to="/tweets" className="text-gray-600 dark:text-gray-300 hover:text-primary">
                <FaTwitter className="text-xl" />
              </Link>

              <Link to="/careers" className="text-gray-600 dark:text-gray-300 hover:text-primary">
                <FaBriefcase className="text-xl" />
              </Link>

              <Link to="/profile" className="text-gray-600 dark:text-gray-300 hover:text-primary">
                <FaUser className="text-xl" />
              </Link>

              <button
                onClick={() => logout()}
                className="text-gray-600 dark:text-gray-300 hover:text-primary"
              >
                <FaSignOutAlt className="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
