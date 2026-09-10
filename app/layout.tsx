import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "./components/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Stremo",
    template: "%s · Stremo",
  },
  description: "Stremo — workspace live screen streaming",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const bootScript = `(()=>{try{var r=document.documentElement,t=localStorage.getItem("stremo-theme"),d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d);r.dataset.theme=t==="light"||t==="dark"||t==="system"?t:"system";r.style.colorScheme=d?"dark":"light";if("__TAURI_INTERNALS__"in window)r.classList.add("tauri-app")}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden text-ink" suppressHydrationWarning>
        <Script id="stremo-boot" strategy="beforeInteractive">
          {bootScript}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
