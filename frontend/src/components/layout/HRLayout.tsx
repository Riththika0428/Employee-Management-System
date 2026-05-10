'use client';

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

const HRLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const pathname = usePathname();
  
  const getPageTitle = () => {
    const path = pathname.split('/')[1];
    return path.charAt(0).toUpperCase() + path.slice(1) || 'Dashboard';
  };

  if (user?.role !== 'hr' && user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-600">Access Denied: HR Role Required</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header title={getPageTitle()} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default HRLayout;
