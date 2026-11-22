import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DacArquitectura",
  description: "Eines internes de DacArquitectura",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body>
        {children}
        {/* LLM Manager feedback mode: a small Feedback button, clients sign in through their portal */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var k="lm_fb",m=location.hash.match(/lm_fb=([\\w.-]+)/);if(m){sessionStorage.setItem(k,m[1]);localStorage.setItem(k,m[1]);history.replaceState(history.state,"",location.pathname+location.search)}}catch(e){}var s=document.createElement("script");s.src="https://llm-manager-dusky.vercel.app/widget.js";s.async=true;document.head.appendChild(s)})();` }} />
      </body>
    </html>
  );
}
