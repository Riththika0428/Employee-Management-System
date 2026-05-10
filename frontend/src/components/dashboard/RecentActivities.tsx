'use client';

import React from 'react';
import { UserPlusIcon, CheckCircleIcon, DocumentTextIcon, ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline';

const activities = [
  {
    id: 1,
    user: 'Sarah Smith',
    action: 'checked in',
    time: '2 mins ago',
    icon: ArrowRightEndOnRectangleIcon,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 2,
    user: 'Mike Johnson',
    action: 'completed task "Q3 Report"',
    time: '1 hour ago',
    icon: CheckCircleIcon,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 3,
    user: 'Design Team',
    action: 'submitted leave requests',
    time: '3 hours ago',
    icon: DocumentTextIcon,
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    id: 4,
    user: 'Admin',
    action: 'added new employee "John Doe"',
    time: '5 hours ago',
    icon: UserPlusIcon,
    color: 'bg-indigo-100 text-indigo-600',
  },
];

const RecentActivities: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
        <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          View all
        </button>
      </div>
      
      <div className="space-y-6">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative flex items-start space-x-4">
            {/* Timeline connector line */}
            {index !== activities.length - 1 && (
              <div className="absolute top-8 bottom-[-24px] left-[15px] w-px bg-gray-200"></div>
            )}
            
            <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${activity.color} ring-4 ring-white`}>
              <activity.icon className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{activity.user}</span> {activity.action}
              </p>
              <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivities;
