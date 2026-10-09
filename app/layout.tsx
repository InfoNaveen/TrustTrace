'use client';

import '../styles/globals.css';
import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { ScanProvider } from '@/components/ScanContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode] = useState(true); // Always dark mode for security theme

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-brand-dark text-gray-100 overflow-hidden">
        <ScanProvider>
          <div className="flex h-screen overflow-hidden relative">
            <Sidebar 
              sidebarOpen={sidebarOpen} 
              setSidebarOpen={setSidebarOpen} 
            />
            
            <div className="flex flex-col flex-1 overflow-hidden relative z-10">
              <Navbar 
                sidebarOpen={sidebarOpen} 
                setSidebarOpen={setSidebarOpen}
              />
              
              <main className="flex-1 overflow-y-auto relative">
                <div className="absolute inset-0 bg-security-gradient opacity-50 pointer-events-none" />
                <div className="relative z-10 p-6 md:p-8">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </ScanProvider>
      </body>
    </html>
  );
}
