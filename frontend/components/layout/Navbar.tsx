'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Upload', href: '/upload', icon: '📁' },
  { 
    name: 'Data', 
    href: '/data/clients', 
    icon: '📊',
    submenu: [
      { name: 'Clients', href: '/data/clients' },
      { name: 'Workers', href: '/data/workers' },
      { name: 'Tasks', href: '/data/tasks' },
      { name: 'Export', href: '/data/export' },
    ]
  },
  { name: 'Rules', href: '/rules', icon: '⚙️' },
  { name: 'Validation', href: '/validation', icon: '✅' },
  { 
    name: 'AI Tools', 
    href: '/ai/chat', 
    icon: '🤖',
    submenu: [
      { name: 'Chat with Data', href: '/ai/chat' },
      { name: 'Query', href: '/ai/query' },
      { name: 'Generate Rule', href: '/ai/rule' },
      { name: 'Fix Errors', href: '/ai/fix' },
      { name: 'Validate', href: '/ai/validate' },
      { name: 'Insights', href: '/ai/insights' },
    ]
  },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🔮</span>
              <span className="text-xl font-bold text-gray-900">Data Alchemist</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <div key={item.name} className="relative group">
                <Link
                  href={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                  {item.submenu && <span className="ml-1">▼</span>}
                </Link>

                {item.submenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      {item.submenu.map((subitem) => (
                        <Link
                          key={subitem.name}
                          href={subitem.href}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname === subitem.href
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {subitem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="text-gray-600 hover:text-gray-900">
              <span className="text-xl">☰</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}