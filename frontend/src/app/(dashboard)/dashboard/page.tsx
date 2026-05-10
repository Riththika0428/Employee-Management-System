'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StatsCard from '@/components/dashboard/StatsCard';
import dynamic from 'next/dynamic';
import RecentActivities from '@/components/dashboard/RecentActivities';
import {
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

const ChartCard = dynamic(() => import('@/components/dashboard/ChartCard'), { ssr: false });

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { title: 'Total Employees', value: '156', icon: UsersIcon, change: '+12%', color: 'bg-blue-500' },
    { title: 'Present Today', value: '142', icon: CheckCircleIcon, change: '+5%', color: 'bg-green-500' },
    { title: 'Pending Tasks', value: '23', icon: ClockIcon, change: '-8%', color: 'bg-yellow-500' },
    { title: 'Payroll This Month', value: '$145,000', icon: CurrencyDollarIcon, change: '+15%', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
  <div className="bg-linear-to-r from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
        <p className="mt-1 text-indigo-100">
          Here's what's happening with your workforce today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Attendance Trend" type="line" />
        <ChartCard title="Task Completion Rate" type="donut" />
      </div>

      {/* Recent Activities */}
      <RecentActivities />
    </div>
  );
}