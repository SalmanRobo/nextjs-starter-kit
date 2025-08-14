'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

interface SearchParamsHandlerProps {
  onParamsChange: (redirectTo?: string) => void
}

export function SearchParamsHandler({ onParamsChange }: SearchParamsHandlerProps) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Extract redirectTo from URL search params
    const redirectTo = searchParams?.get('redirectTo') || undefined
    onParamsChange(redirectTo)
  }, [searchParams, onParamsChange])
  
  return null
}