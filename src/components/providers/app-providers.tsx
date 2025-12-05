"use client"

import type { ReactNode } from "react"

import { NextAuthProvider } from "./session-provider"
import { Toaster } from "@/components/ui/sonner"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NextAuthProvider>
      {children}
      <Toaster />
    </NextAuthProvider>
  )
}
