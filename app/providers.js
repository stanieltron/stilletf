"use client";

import { SessionProvider } from "next-auth/react";
import SignInModal from "./components/SignInModal";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      <SignInModal />
    </SessionProvider>
  );
}
