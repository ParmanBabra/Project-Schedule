import { expect, type Page } from '@playwright/test'

/** With a DatePicker already open, navigate to the month of `iso` and click the day. */
export async function pickDate(page: Page, iso: string): Promise<void> {
  const picker = page.getByTestId('date-picker')
  await expect(picker).toBeVisible()
  const [y, m] = iso.split('-').map(Number)
  const target = y * 12 + (m - 1)
  for (let i = 0; i < 24; i++) {
    const day = picker.getByTestId(`day-${iso}`)
    // the cell exists (possibly as an "outside" day) once the grid covers that month
    const month = await picker.getByRole('grid').getAttribute('aria-label')
    const shown = monthIndex(month ?? '')
    if (shown === target) break
    await picker.getByRole('button', { name: shown < target ? 'เดือนถัดไป' : 'เดือนก่อนหน้า' }).click()
    void day
  }
  await picker.getByTestId(`day-${iso}`).click()
  await expect(picker).toHaveCount(0)
}

const THAI_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

/** "กันยายน 2569" -> absolute month index (ค.ศ. * 12 + month) */
function monthIndex(label: string): number {
  const [name, be] = label.split(' ')
  return (Number(be) - 543) * 12 + THAI_MONTHS_LONG.indexOf(name)
}
