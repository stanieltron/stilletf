"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import SignInModal from "./components/SignInModal";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      <Suspense fallback={null}>
        <SignInModal />
      </Suspense>
    </SessionProvider>
  );
}
