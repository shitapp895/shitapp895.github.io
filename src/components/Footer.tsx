import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-slate-800 shadow-inner py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} ShitApp - Connect during bathroom breaks
          </p>
          <div className="mt-2 md:mt-0">
            <Link to="/careers" className="text-sm text-primary hover:underline">
              Careers
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
