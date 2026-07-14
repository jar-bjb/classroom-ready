import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Classroom Ready",
  description: "Sistem checklist kesiapan ruang pembelajaran",
  applicationName: "Classroom Ready",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable lock — blocking pinch-zoom fails WCAG 1.4.4.
  themeColor: "#fbfaf7",
};

// Runs before paint to apply the saved theme, avoiding a flash of light theme for
// dark-mode users on every navigation (the React toggle only applies post-hydration).
const themeInitScript = `(function(){try{var t=localStorage.getItem('classroom-ready-theme');if(t!=='dark'&&t!=='light')t='light';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#191816':'#fbfaf7');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`} data-theme="light">
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
