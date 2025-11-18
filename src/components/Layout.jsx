import React from 'react';
import { LayoutDashboard, ShoppingCart, Users, Settings, Menu, Bell, Search } from 'lucide-react';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
            {/* Sidebar */}
            <aside
                className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'w-72' : 'w-20'}`}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
                    <div className={`flex items-center gap-3 ${!isSidebarOpen && 'hidden'}`}>
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">S</span>
                        </div>
                        <h1 className="font-bold text-xl tracking-tight text-gray-900">SalesDash</h1>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1">
                    <NavItem icon={<LayoutDashboard size={22} />} label="Dashboard" isOpen={isSidebarOpen} active />
                    <NavItem icon={<ShoppingCart size={22} />} label="Orders" isOpen={isSidebarOpen} />
                    <NavItem icon={<Users size={22} />} label="Customers" isOpen={isSidebarOpen} />
                    <div className="pt-4 mt-4 border-t border-gray-100">
                        <NavItem icon={<Settings size={22} />} label="Settings" isOpen={isSidebarOpen} />
                    </div>
                </nav>

                <div className={`p-4 border-t border-gray-100 ${!isSidebarOpen && 'hidden'}`}>
                    <div className="flex items-center gap-3">
                        <img src="https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff" alt="User" className="w-10 h-10 rounded-full" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Admin User</p>
                            <p className="text-xs text-gray-500">admin@company.com</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <div className="flex items-center gap-4 w-96">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-gray-100 rounded-full relative text-gray-500 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, isOpen, active }) => (
    <button
        className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group
    ${active
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
    >
        <div className={`transition-colors ${active ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
            {icon}
        </div>
        <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-200 ${!isOpen && 'hidden opacity-0'}`}>
            {label}
        </span>
        {active && isOpen && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"></div>
        )}
    </button>
);

export default Layout;
