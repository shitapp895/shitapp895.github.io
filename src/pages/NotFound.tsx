import { FaToilet, FaHome } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-background-dark p-4">
      <div className="text-center">
        <FaToilet className="text-primary text-8xl mx-auto mb-6" />

        <h1 className="text-4xl font-bold mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>

        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Oops! Looks like this page has been flushed away. Maybe it's taking a bathroom break?
        </p>

        <Link to="/" className="btn btn-primary inline-flex items-center space-x-2">
          <FaHome />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
