import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('แสดงสถานะ "พร้อม" เมื่อ backend ตอบ ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), { status: 200 })),
    )
    renderWithProviders(<HomePage />)
    expect(screen.getByRole('heading', { name: 'แผนงาน' })).toBeInTheDocument()
    expect(await screen.findByText('พร้อม')).toBeInTheDocument()
  })

  it('แสดง "เชื่อมต่อไม่ได้" เมื่อ backend ล้มเหลว', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })))
    renderWithProviders(<HomePage />)
    expect(await screen.findByText('เชื่อมต่อไม่ได้')).toBeInTheDocument()
  })
})
