import "./globals.css";         


import Providers from "./providers"; // client wrapper

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="sona-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
