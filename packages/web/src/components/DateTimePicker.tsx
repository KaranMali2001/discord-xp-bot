import { CalendarClock } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DateTimePickerProps = {
  /** "YYYY-MM-DDTHH:MM" IST wall-clock, or '' when unset. */
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  /** Disable calendar days before today. */
  disablePast?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DDTHH:MM" → { date (local), time "HH:MM" }. */
function parse(value: string): { date: Date | undefined; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return { date: undefined, time: '' }
  return {
    date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    time: `${m[4]}:${m[5]}`,
  }
}

function combine(date: Date, time: string): string {
  const t = /^(\d{2}):(\d{2})$/.test(time) ? time : '18:00'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${t}`
}

const DISPLAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Date + time picker for IST wall-clock scheduling. Wraps the shadcn calendar in a
 * popover for the date and a time field for the clock, and emits the same
 * "YYYY-MM-DDTHH:MM" string a native datetime-local would, so callers keep using
 * `istDateTimeLocalToEpochSec` unchanged.
 */
export function DateTimePicker({
  value,
  onChange,
  id,
  disabled,
  disablePast = true,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const { date, time } = parse(value)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let label: string | null = null
  if (date && /^(\d{2}):(\d{2})$/.test(time)) {
    const [h, mi] = time.split(':').map(Number)
    const withClock = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, mi)
    label = `${DISPLAY.format(withClock)} IST`
  }

  const pickDate = (next: Date | undefined) => {
    if (!next) return
    onChange(combine(next, time))
  }

  const pickTime = (nextTime: string) => {
    onChange(combine(date ?? new Date(), nextTime))
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-[15rem] justify-start font-normal',
                !label && 'text-muted-foreground',
              )}
            >
              <CalendarClock className="opacity-70" />
              {label ?? 'Pick date & time'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(next) => {
                pickDate(next)
                setOpen(false)
              }}
              disabled={disablePast ? { before: today } : undefined}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id ? `${id}-time` : undefined} className="sr-only">
          Time (IST)
        </Label>
        <Input
          id={id ? `${id}-time` : undefined}
          type="time"
          className="w-[8.5rem]"
          value={time}
          disabled={disabled}
          onChange={(e) => pickTime(e.target.value)}
        />
      </div>
    </div>
  )
}
