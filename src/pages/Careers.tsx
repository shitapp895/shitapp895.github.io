import React from 'react';

const Careers: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Careers at ShitApp</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Summer Internship Opportunity</h2>
        
        <div className="mb-4">
          <h3 className="text-xl font-medium mb-2">About Us</h3>
          <p className="text-gray-700 mb-4">
            ShitApp is a dynamic and innovative social platform where creativity meets technology.
            We're on a mission to create meaningful connections and provide unique digital experiences
            for our growing user community.
          </p>
        </div>

        <div className="mb-4">
          <h3 className="text-xl font-medium mb-2">Internship Description</h3>
          <p className="text-gray-700 mb-4">
            We're looking for passionate and talented students to join our team for the summer.
            This is a hands-on opportunity to work on real projects, develop your skills, and make
            a meaningful impact on our product and users.
          </p>
          
          <ul className="list-disc pl-5 mb-4 text-gray-700">
            <li>Collaborate with our development team on exciting new features</li>
            <li>Gain experience with modern web technologies and frameworks</li>
            <li>Participate in design and code reviews</li>
            <li>Learn about product development in a fast-paced environment</li>
            <li>Receive mentorship from experienced professionals</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-xl font-medium mb-2">Qualifications</h3>
          <ul className="list-disc pl-5 mb-4 text-gray-700">
            <li>Currently pursuing a degree in Computer Science, Software Engineering, or related field</li>
            <li>Basic knowledge of web development (HTML, CSS, JavaScript)</li>
            <li>Enthusiasm for learning new technologies</li>
            <li>Strong problem-solving skills</li>
            <li>Excellent communication and teamwork abilities</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">How to Apply</h3>
          <p className="text-gray-700">
            Send your resume and a brief introduction about why you're interested in joining our team to:
            <a href="mailto:shitapp895@gmail.com" className="text-blue-600 font-medium ml-1 hover:underline">
              shitapp895@gmail.com
            </a>
          </p>
        </div>

        <div className="bg-gray-100 p-4 rounded-md">
          <p className="text-gray-800 font-medium">
            We look forward to hearing from you and potentially welcoming you to the ShitApp team this summer!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Careers; 