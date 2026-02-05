import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export const DateSelector = ({ selectedDate, onDateChange }: DateSelectorProps) => {
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    onDateChange(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    onDateChange(newDate);
  };

  const isToday = isSameDay(selectedDate, new Date());

  // Get week days starting from Monday
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header with date and calendar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-foreground">
            {format(selectedDate, 'MMMM d, yyyy')}
          </span>
          {!isToday && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDateChange(new Date())}
              className="text-primary hover:text-primary/80 text-sm"
            >
              Today
            </Button>
          )}
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Week day selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousWeek}
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center justify-between flex-1 gap-1">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isSameDay(day, new Date());
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[44px] ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : isDayToday
                    ? 'bg-secondary text-foreground'
                    : 'hover:bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="text-xs font-medium uppercase tracking-wide">
                  {format(day, 'EEE')}
                </span>
                <span className={`text-lg font-semibold ${isSelected ? '' : ''}`}>
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextWeek}
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
