import type { Metadata } from "next";
import "./globals.css";
import "./brand-theme.css";
import "./student-history.css";
import "./auth.css";
export const metadata: Metadata = { title: "Yuvabe | Mentor Workspace", description: "Batch-specific projects, learning progress, and attributed token usage." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('yuvabe-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()` }}/></head><body>{children}</body></html>;
}
