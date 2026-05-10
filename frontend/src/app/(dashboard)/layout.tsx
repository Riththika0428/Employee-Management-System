'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layout/AdminLayout';
import HRLayout from '@/components/layout/HRLayout';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import Loader from '@/components/common/Loader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen />;
  }

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'admin':
      return <AdminLayout>{children}</AdminLayout>;
    case 'hr':
      return <HRLayout>{children}</HRLayout>;
    case 'employee':
      return <EmployeeLayout>{children}</EmployeeLayout>;
    default:
      return <div>Invalid role</div>;
  }
}