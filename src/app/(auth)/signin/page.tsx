'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { easeOut, duration, staggerContainer, staggerItem } from '@/lib/animations'

// Google logo with proper colors
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()

  // Get the callback URL from search params (where user was trying to go)
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const handleSignIn = async () => {
    setIsLoading(true)
    await signIn('google', { callbackUrl })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Safe area padding for notch devices */}
      <div className="h-safe-area-inset-top" />

      {/* Main content - centered vertically */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          variants={staggerContainer}
          initial={false}
          animate="animate"
          className="w-full max-w-sm space-y-8"
        >
          {/* Logo and branding */}
          <motion.div variants={staggerItem} initial={false} className="text-center space-y-4">
            {/* Animated logo */}
            <motion.div
              initial={false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: duration.page,
                ease: easeOut,
                delay: 0.1
              }}
              className="flex justify-center"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />
                {/* Logo */}
                <div className="relative flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl md:text-3xl shadow-lg">
                  SH
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
                Welcome to Sophie Hub
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Partner and staff management for Sophie Society
              </p>
            </div>
          </motion.div>

          {/* Sign in card */}
          <motion.div
            variants={staggerItem}
            initial={false}
            className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm"
          >
            <div className="space-y-6">
              {/* Info text */}
              <p className="text-center text-sm text-muted-foreground">
                Sign in with your Sophie Society Google account
              </p>

              {/* Google sign in button - 44px+ touch target */}
              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ duration: duration.micro, ease: easeOut }}
              >
                <Button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  variant="outline"
                  className={cn(
                    'w-full h-12 md:h-14 gap-3 text-base font-medium',
                    'border-border/60 hover:border-border hover:bg-accent/50',
                    'transition-all duration-200'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <GoogleLogo className="h-5 w-5" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.p
            variants={staggerItem}
            initial={false}
            className="text-center text-xs text-muted-foreground/60"
          >
            Internal tool for Sophie Society team members
          </motion.p>
        </motion.div>
      </div>

      {/* Safe area padding for home indicator */}
      <div className="h-safe-area-inset-bottom" />
    </div>
  )
}
