'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-background to-muted/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="max-w-md w-full text-center space-y-8"
      >
        {/* Animated 404 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          className="relative"
        >
          <div className="text-[120px] font-bold text-muted-foreground/20 leading-none select-none">
            404
          </div>
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.3 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="h-20 w-20 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <HelpCircle className="h-10 w-10 text-orange-500" />
            </div>
          </motion.div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut, delay: 0.2 }}
          className="space-y-3"
        >
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button asChild variant="default" className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: easeOut, delay: 0.4 }}
          className="pt-8 border-t border-border/50"
        >
          <p className="text-xs text-muted-foreground mb-4">Quick links</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/partners"
              className="text-sm px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              Partners
            </Link>
            <Link
              href="/staff"
              className="text-sm px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              Staff
            </Link>
            <Link
              href="/admin/data-enrichment"
              className="text-sm px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              Data Enrichment
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
