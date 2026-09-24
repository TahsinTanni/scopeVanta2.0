import type { Metadata } from "next";
import { Newsreader, Manrope, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ClickSpark from "@/components/ClickSpark";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Absolute base for Open Graph/Twitter image URLs; falls back to Next's
  // default (localhost / Vercel URL) when the env var isn't set.
  ...(process.env.NEXT_PUBLIC_APP_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) } : {}),
  title: "ScopeVanta",
  description: "Commercial intelligence for service businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${newsreader.variable} ${manrope.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      >
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          />
          {/* Resolves system/light/dark before first paint so there is no flash of the wrong theme.
              The landing page ("/") is always dark — see LandingPage.tsx. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var m=localStorage.getItem("scopevanta:theme");var d=location.pathname==="/"||m==="dark"||(m!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
            }}
          />
        </head>
        <body suppressHydrationWarning className="min-h-full flex flex-col bg-surface-0 text-ink-primary font-body">
          <ClickSpark sparkColor="#4E8770" sparkCount={6} duration={300}>
            {children}
          </ClickSpark>
        </body>
      </html>
    </ClerkProvider>
  );
}
