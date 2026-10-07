import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { RoomUsageSection } from '@/components/RoomUsageSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { STOCK_ROOMS, STOCK_SHIFTS } from '@/lib/roomStock';
import type { ShiftType } from '@/types/contrast';

export default function DailyUsage() {
  const [date, setDate] = useState(format(new Date(),'yyyy-MM-dd'));
  const [shift, setShift] = useState<ShiftType>('morning');
  const [room, setRoom] = useState('CT');
  const [category, setCategory] = useState<'films'|'supplies'>('films');
  const [dirty, setDirty] = useState(false);
  return <div className="min-h-screen bg-background"><AppNavigation />
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
      <div><h1 className="text-2xl font-bold">Daily usage</h1><p className="text-muted-foreground mt-1 max-w-prose">Choose the date, shift and room. Record what was actually used, then save.</p></div>
      <div className="space-y-4 border-b pb-5">
        <div className="flex flex-wrap items-end gap-4"><div><Label htmlFor="usage-date">Date</Label><Input id="usage-date" className="w-auto" type="date" max={format(new Date(),'yyyy-MM-dd')} value={date} disabled={dirty} onChange={e => {if(e.target.value)setDate(e.target.value);}} /></div><Button variant="outline" disabled={dirty} onClick={() => setDate(format(new Date(),'yyyy-MM-dd'))}>Today</Button></div>
        <fieldset><legend className="text-sm font-medium mb-2">Shift</legend><div className="flex flex-wrap gap-2">{STOCK_SHIFTS.map(value => <Button key={value} aria-pressed={shift===value} disabled={dirty} variant={shift===value?'default':'outline'} className="capitalize" onClick={() => setShift(value)}>{value}</Button>)}</div></fieldset>
        <fieldset><legend className="text-sm font-medium mb-2">Room</legend><div className="flex flex-wrap gap-2">{STOCK_ROOMS.map(value => <Button key={value} aria-pressed={room===value} disabled={dirty} variant={room===value?'default':'outline'} onClick={() => setRoom(value)}>{value}</Button>)}</div></fieldset>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="What was used"><Button disabled={dirty} aria-pressed={category==='films'} variant={category==='films'?'default':'outline'} onClick={() => setCategory('films')}>Films printed</Button><Button disabled={dirty} aria-pressed={category==='supplies'} variant={category==='supplies'?'default':'outline'} onClick={() => setCategory('supplies')}>Contrast and supplies</Button></div>
      {dirty && <p className="text-sm text-muted-foreground" role="status">Save or discard your changes before switching the date, shift, room or entry type.</p>}
      <RoomUsageSection key={`${date}/${shift}/${room}/${category}`} shift={shift} date={new Date(`${date}T12:00:00`)} category={category} selectedRoom={room} onDirtyChange={setDirty} />
      <div className="border-t pt-4 text-sm text-muted-foreground space-y-2"><p>Picked stock is recorded under <Link className="text-primary underline" to="/stock/pick">Pick for a room</Link>. A pick is not usage.</p><p><Link className="text-primary underline" to="/clinical">Clinical contrast record</Link> remains available separately. It records clinical volumes and patient counts; it does not deduct shared stock.</p></div>
    </main>
  </div>;
}
