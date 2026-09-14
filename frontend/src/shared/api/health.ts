import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface Health {
  status: string
  version: string
  dataDir?: string
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    retry: 0,
  })
}
