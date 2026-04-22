// Reusable date picker using shadcn Calendar + Popover.
// Accepts / emits "YYYY-MM-DD" strings (same format as <input type=date>),
// so existing form state handling keeps working.
import { useState } from 'react';
import { format, parse, isValid } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, X } from 'lucide-react';

export default function DatePicker({
  value, onChange, placeholder = 'Pick a date', className = '',
  minDate, maxDate, testId,
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const handleSelect = (date) => {
    if (!date) return onChange('');
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid={testId}
          className={`justify-start font-normal h-12 border-[#E2E3DD] hover:bg-white ${!selected ? 'text-[#6B6E66]' : 'text-[#1B3C35]'} ${className}`}>
          <CalendarIcon className="h-4 w-4 mr-2 shrink-0 text-[#C96A52]" />
          <span className="flex-1 text-left truncate">
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </span>
          {selected && (
            <X className="h-3.5 w-3.5 text-[#6B6E66] hover:text-red-500 shrink-0"
              onClick={clear} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={(d) => (minDate && d < minDate) || (maxDate && d > maxDate)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
