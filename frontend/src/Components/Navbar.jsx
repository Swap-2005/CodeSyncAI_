import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <div className='flex justify-between items-center bg-white shadow-md p-4'>
      {/* Logo Section */}
      <Link to='/' className='flex items-center gap-3 group'>
        <div className='w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shadow-md relative overflow-hidden group-hover:scale-105 transition-transform duration-300'>
          <div className='absolute top-0 left-0 right-0 h-4 bg-gray-100 flex items-center justify-start px-1.5'>
            <div className='flex gap-1'>
              <div className='w-1.5 h-1.5 bg-gray-400 rounded-full'></div>
              <div className='w-1.5 h-1.5 bg-gray-400 rounded-full'></div>
              <div className='w-1.5 h-1.5 bg-gray-400 rounded-full'></div>
            </div>
          </div>
          <div className='w-8 h-6 flex flex-col justify-center gap-1 mt-2'>
            <div className='h-1 w-full bg-gray-400 rounded-sm'></div>
            <div className='h-1 w-3/4 bg-gray-400 rounded-sm'></div>
          </div>
        </div>
        <span className='text-2xl font-semibold text-gray-800 tracking-wide group-hover:text-blue-600 transition-colors duration-300'>CodeSyncAI</span>
      </Link>

      {/* Navigation Links */}
      <div className='flex items-center gap-6'>
        <Link to="/schedulepage" className="text-gray-700 hover:text-blue-600 transition-colors duration-300">Schedule</Link>
        <Link to="/analytics" className="text-gray-700 hover:text-blue-600 transition-colors duration-300">Analytics</Link>
        
        {localStorage.getItem('auth-token') ? (
          <button 
            onClick={() => {
              localStorage.removeItem('auth-token');
              window.location.replace('/');
            }} 
            className='px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg'
          >
            Logout
          </button>
        ) : (
          <Link 
            to='/login' 
            className='px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg'
          >
            Login
          </Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;
