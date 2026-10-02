import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Film } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ShiftType } from '@/types/contrast';

const ROOMS = ['X-ray', 'CT', 'MRI', 'Fluoroscopy'] as const;
const SIZES = ['17 × 14', '12 × 10'] as const;
type FilmData = Record<string, Record<string, number>>;

const emptyData = (): FilmData => Object.fromEntries(ROOMS.map(room => [room, { patients: 0, ...Object.fromEntries(SIZES.map(size => [size, 0])) }]));

export function FilmUsageSection({ shift, date }: { shift: ShiftType; date: Date }) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const storageKey = `radcontrack-film-${dateKey}-${shift}`;
  const [data, setData] = useState<FilmData>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? { ...emptyData(), ...JSON.parse(saved) } : emptyData();
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('radcontrack:film-updated'));
  }, [data, storageKey]);

  const sizeTotals = useMemo(() => Object.fromEntries(SIZES.map(size => [size, ROOMS.reduce((sum, room) => sum + (data[room]?.[size] || 0), 0)])), [data]);
  const patientTotal = ROOMS.reduce((sum, room) => sum + (data[room]?.patients || 0), 0);
  const perPatient = (films: number, patients: number) => patients > 0 ? (films / patients).toFixed(2) : '—';

  const update = (room: string, size: string, value: string) => setData(current => ({
    ...current,
    [room]: { ...current[room], [size]: Math.max(0, Math.floor(Number(value) || 0)) },
  }));

  return <section className="dashboard-card overflow-hidden border-l-4 border-l-sky-500">
    <div className="px-5 py-4 border-b bg-sky-50/60 dark:bg-sky-950/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Film className="h-5 w-5 text-sky-600" /><div><h3 className="font-bold capitalize">{shift} shift film printing</h3><p className="text-xs text-muted-foreground">Count patients who received printed films, then enter films by size.</p></div></div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold">
        <span className="rounded-full bg-sky-600 text-white px-3 py-1 whitespace-nowrap">{patientTotal} patients</span>
        <span className="rounded-full bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100 px-3 py-1 whitespace-nowrap">17 × 14: {sizeTotals['17 × 14']}</span>
        <span className="rounded-full bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100 px-3 py-1 whitespace-nowrap">12 × 10: {sizeTotals['12 × 10']}</span>
      </div>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Room</th><th className="px-3 py-3 text-center whitespace-nowrap">Patients printed for</th>{SIZES.map(size => <th key={size} colSpan={2} className="px-3 py-3 text-center whitespace-nowrap border-l">{size}</th>)}</tr><tr><th /><th />{SIZES.map(size => <Fragment key={size}><th className="px-3 pb-3 text-center text-xs font-medium text-muted-foreground border-l">Films printed</th><th className="px-3 pb-3 text-center text-xs font-medium text-muted-foreground">Per patient</th></Fragment>)}</tr></thead>
      <tbody>{ROOMS.map(room => <tr key={room} className="border-t">
        <td className="px-4 py-3 font-semibold">{room}</td>
        <td className="p-2"><Input aria-label={`${room} patients printed for`} className="w-20 mx-auto text-center" type="number" min="0" step="1" value={data[room]?.patients || ''} onChange={e => update(room, 'patients', e.target.value)} placeholder="0" /></td>
        {SIZES.map(size => <Fragment key={size}><td className="p-2 border-l"><Input aria-label={`${room} ${size} films printed`} className="w-20 mx-auto text-center" type="number" min="0" value={data[room]?.[size] || ''} onChange={e => update(room, size, e.target.value)} placeholder="0" /></td><td className="px-4 py-3 text-center font-semibold">{perPatient(data[room]?.[size] || 0, data[room]?.patients || 0)}</td></Fragment>)}
      </tr>)}</tbody>
      <tfoot className="border-t-2 bg-muted/40 font-bold"><tr><td className="px-4 py-3">Shift totals</td><td className="px-3 py-3 text-center">{patientTotal}</td>{SIZES.map(size => <Fragment key={size}><td className="px-3 py-3 text-center text-lg text-sky-700 dark:text-sky-400 border-l">{sizeTotals[size]}</td><td className="px-4 py-3 text-center">{perPatient(sizeTotals[size], patientTotal)}</td></Fragment>)}</tr></tfoot>
    </table></div>
  </section>;
}
