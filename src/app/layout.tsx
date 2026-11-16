import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import { SummitContentProvider } from '@/components/content/summit-content-provider';
import { TikTokFooter } from '@/components/footer/tiktok-footer';

export const metadata: Metadata = {
  title: 'Summit Navigator',
  description: 'Interactive dashboard for the Leadership Summit.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-muted/40">
        <FirebaseClientProvider>
          <SummitContentProvider>
            <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-24">
                {children}
            </div>
            <TikTokFooter />
            <Toaster />
          </SummitContentProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}