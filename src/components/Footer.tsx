import { FaGithub } from 'react-icons/fa'

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-slate-800 shadow-inner py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} ShitApp - Connect during bathroom breaks
          </p>
          
          <div className="flex items-center space-x-4 mt-2 md:mt-0">
            <a 
              href="https://github.com/shitapp895/ShitApp" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 dark:text-gray-400 hover:text-primary"
            >
              <FaGithub className="text-xl" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer 