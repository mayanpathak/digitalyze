import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { Metadata } from 'next';
import './globals.css';
import Navbar from '../../components/layout/Navbar';
import QueryProvider from '../../components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Data Alchemist - AI Resource Allocation',
  description: 'AI-enhanced data ingestion and validation platform for resource allocation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </div>
          <Toaster position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}