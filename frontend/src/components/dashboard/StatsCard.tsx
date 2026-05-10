'use client';

import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon: Icon, color = 'bg-indigo-500' }) => {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <div className="flex items-center mt-2">
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {change}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
