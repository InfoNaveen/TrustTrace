'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Upload, 
  ShieldAlert, 
  Clock, 
  Wrench, 
  Settings,
  ChevronLeft,
  Shield,
  Activity,
  FlaskConical
} from 'lucide-react';
import { sidebarVariants, fadeIn } from '@/lib/motion';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Upload & Scan', href: '/upload', icon: Upload },
  { name: 'Scan Results', href: '/scan-results', icon: ShieldAlert },
  { name: 'Security Timeline', href: '/timeline', icon: Clock },
  { name: 'Patches', href: '/patches', icon: Wrench },
  { name: 'TrustTrace', href: '/trusttrace', icon: FlaskConical },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ 
  sidebarOpen, 
  setSidebarOpen 
}: { 
  sidebarOpen: boolean; 
  setSidebarOpen: (open: boolean) => void; 
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar backdrop (mobile only) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar component */}
      <motion.aside
        variants={sidebarVariants}
        animate={sidebarOpen ? 'open' : 'closed'}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col mica-strong border-r border-gray-600/30 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ width: sidebarOpen ? '280px' : '80px' }}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Section */}
          <div className="flex items-center justify-between h-20 px-4 border-b border-cyan-500/20">
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.div
                  key="logo-expanded"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center space-x-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-brand-secondary/20 blur-xl rounded-lg" />
                    <Shield className="h-8 w-8 text-brand-secondary relative z-10" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-brand-secondary to-brand-primary bg-clip-text text-transparent">
                      DevSentinel
                    </h1>
                    <p className="text-xs text-gray-400">AI Security Platform</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="logo-collapsed"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center w-full"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-brand-secondary/20 blur-xl rounded-lg" />
                    <Shield className="h-8 w-8 text-brand-secondary relative z-10" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              className="md:hidden ml-2 rounded-md text-gray-400 hover:text-cyan-400 focus:outline-none transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Close sidebar</span>
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    className={`group relative flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-white/5 text-white border-l-4 border-brand-secondary shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50 border border-transparent'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-brand-secondary rounded-r-full"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={`flex-shrink-0 h-5 w-5 ${
                        isActive ? 'text-brand-secondary' : 'text-gray-500 group-hover:text-brand-secondary'
                      } transition-colors`}
                    />
                    <AnimatePresence>
                      {sidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="ml-3 truncate"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && (
                      <motion.div
                        className="absolute right-2 w-2 h-2 bg-brand-secondary rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Status Indicator */}
          <div className="px-4 py-4 border-t border-cyan-500/20">
            <AnimatePresence>
              {sidebarOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600/30"
                >
                  <div className="relative">
                    <Activity className="h-4 w-4 text-brand-secondary" />
                    <motion.div
                      className="absolute inset-0 bg-brand-secondary rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-brand-secondary">Pipeline Active</p>
                    <p className="text-xs text-gray-500 truncate">Sentinel scanning...</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center"
                >
                  <div className="relative">
                    <Activity className="h-5 w-5 text-brand-secondary" />
                    <motion.div
                      className="absolute inset-0 bg-brand-secondary rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
