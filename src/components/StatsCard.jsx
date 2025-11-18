import React from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, ShoppingBag, Activity } from 'lucide-react';

const StatsCard = ({ title, value, change, isPositive }) => {
    const getIcon = () => {
        switch (title) {
            case 'Total Sales': return <DollarSign size={20} className="text-blue-600" />;
            case 'Active Users': return <Users size={20} className="text-purple-600" />;
            case 'New Orders': return <ShoppingBag size={20} className="text-orange-600" />;
            case 'Revenue': return <Activity size={20} className="text-green-600" />;
            default: return <Activity size={20} className="text-gray-600" />;
        }
    };

    const getBgColor = () => {
        switch (title) {
            case 'Total Sales': return 'bg-blue-50';
            case 'Active Users': return 'bg-purple-50';
            case 'New Orders': return 'bg-orange-50';
            case 'Revenue': return 'bg-green-50';
            default: return 'bg-gray-50';
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${getBgColor()}`}>
                    {getIcon()}
                </div>
            </div>
            <div className="mt-4 flex items-center">
                <span className={`inline-flex items-center text-sm font-medium px-2 py-0.5 rounded-full
          ${isPositive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                    {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
                    {change}
                </span>
                <span className="text-gray-400 text-sm ml-2">vs last month</span>
            </div>
        </div>
    );
};

export default StatsCard;
