import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  initialDate?: string;
  onSave: (isoDate: string | undefined) => void;
  onClose: () => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({ initialDate, onSave, onClose }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [time, setTime] = useState("09:00");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      setViewDate(d);
      setSelectedDate(d);
      // Extract HH:mm from the local date object
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    } else {
      // Default to tomorrow if no date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setViewDate(tomorrow);
      setSelectedDate(tomorrow);
    }
  }, [initialDate]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  const handleSave = () => {
    if (!selectedDate) {
      onClose();
      return;
    }
    
    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const finalDate = new Date(selectedDate);
    finalDate.setHours(hours, minutes, 0, 0);
    
    onSave(finalDate.toISOString());
    onClose();
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Sunday

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
    const isSelected = selectedDate && currentDate.toDateString() === selectedDate.toDateString();
    const isToday = new Date().toDateString() === currentDate.toDateString();

    days.push(
      <button
        key={i}
        onClick={() => handleDateClick(i)}
        className={`
          w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors
          ${isSelected 
            ? 'bg-indigo-600 text-white' 
            : isToday 
              ? 'text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100' 
              : 'text-gray-700 hover:bg-gray-100'
          }
        `}
      >
        {i}
      </button>
    );
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div ref={containerRef} className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-72 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 mb-2 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <span key={day} className="text-xs font-medium text-gray-400">{day}</span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days}
      </div>

      {/* Time Selection */}
      <div className="flex items-center gap-2 mb-4 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-500 font-medium">Time:</span>
        <input 
          type="time" 
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 font-medium p-0 w-full cursor-pointer"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
         <button 
           onClick={() => { onSave(undefined); onClose(); }}
           className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
         >
           Clear
         </button>
         <button 
           onClick={handleSave}
           className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
         >
           Set Date
         </button>
      </div>
    </div>
  );
};