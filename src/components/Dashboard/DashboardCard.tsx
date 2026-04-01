
import React from 'react';

export type DashboardCardProps = {
    title: string;
    count: number;
    icon: React.ReactNode;
    onClick: () => void;
};

export function DashboardCard({ title, count, icon, onClick }: DashboardCardProps) {
    return (
        <div
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 cursor-pointer hover:bg-gray-700/80 transition-all duration-200 shadow-md flex items-center justify-between"
            onClick={onClick}
        >
            <div>
                <p className="text-gray-400 text-sm font-medium">{title}</p>
                <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-white tracking-tight">{count}</p>
                </div>
                <p className="text-gray-500 text-xs mt-3">View all {title.toLowerCase()}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg text-gray-300">
                {icon}
            </div>
        </div>
    );
}
