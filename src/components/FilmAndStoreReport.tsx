import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { roomUnit, stockAmount, bottleCapacity } from '@/lib/roomStock';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Film, Boxes } from 'lucide-react';

const ROOMS = ['X-ray', 'CT', 'MRI', 'Fluoroscopy'];
const perPatient = (films: number, patients: number) => patients > 0 ? (films / patients).toFixed(2) : '—';
const SHIFTS = ['morning', 'afternoon', 'night'];
type FilmRow = { date: string; room: string; patients: number; film1714: number; film1210: number };
type IssueRow = { id: string; date: string; itemName: string; quantity: number; unit: string; expectedBalance: number; issuedBy: string };

export function FilmAndStoreReport({ start, end }: { start: Date; end: Date }) {
  const startKey = format(start, 'yyyy-MM-dd');
  const endKey = format(end, 'yyyy-MM-dd');
  const [shared,setShared]=useState<Tables<'stock_shift_usage'>[]>([]);
  const [sharedMovements,setSharedMovements]=useState<Tables<'stock_movements'>[]>([]);
  const [reportError,setReportError]=useState('');
  const [catalogue,setCatalogue]=useState<Tables<'stock_items'>[]>([]);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      setShared([]);setSharedMovements([]);
      const usage:Tables<'stock_shift_usage'>[]=[];
      const movements:Tables<'stock_movements'>[]=[];
      const itemResult=await supabase.from('stock_items').select('*');
      if(itemResult.error){if(active)setReportError(itemResult.error.message);return;}
      for(let offset=0;;offset+=1000){
        const result=await supabase.from('stock_shift_usage').select('*').gte('date',startKey).lte('date',endKey).order('date').order('room').order('shift').order('category').range(offset,offset+999);
        if(result.error){if(active)setReportError(result.error.message);return;}
        usage.push(...result.data);if(result.data.length<1000)break;
      }
      for(let offset=0;;offset+=1000){
        const result=await supabase.from('stock_movements').select('*').eq('movement_type','issue').gte('occurred_on',startKey).lte('occurred_on',endKey).order('created_at').order('id').range(offset,offset+999);
        if(result.error){if(active)setReportError(result.error.message);return;}
        movements.push(...result.data);if(result.data.length<1000)break;
      }
      if(active){setShared(usage);setSharedMovements(movements);setCatalogue(itemResult.data);setReportError('');}
    };
    void load();return()=>{active=false;};
  },[startKey,endKey]);
  const { filmRows, issueRows } = useMemo(() => {
    const filmRows: FilmRow[] = [];
    const dates = new Set<string>();
    for(const row of shared.filter(row=>row.category==='films'))dates.add(row.date);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || '';
      const match = key.match(/^radcontrack-film-(\d{4}-\d{2}-\d{2})-(morning|afternoon|night)$/);
      if (match && match[1] >= startKey && match[1] <= endKey) dates.add(match[1]);
    }
    for (const date of [...dates].sort()) {
      for (const room of ROOMS) {
        const row = { date, room, patients: 0, film1714: 0, film1210: 0 };
        for (const shift of SHIFTS) {
          let saved: Record<string, Record<string, number>> = {};
          try { saved = JSON.parse(localStorage.getItem(`radcontrack-film-${date}-${shift}`) || '{}'); } catch { /* skip damaged local entry */ }
          const sharedRow=shared.find(entry=>entry.category==='films'&&entry.date===date&&entry.room===room&&entry.shift===shift);
          const values=sharedRow?.quantities as Record<string,number>|undefined;
          row.patients += sharedRow ? sharedRow.patients : Number(saved[room]?.patients) || 0;
          row.film1714 += sharedRow ? values?.film1714||0 : Number(saved[room]?.['17 × 14']) || 0;
          row.film1210 += sharedRow ? values?.film1210||0 : Number(saved[room]?.['12 × 10']) || 0;
        }
        if (row.patients || row.film1714 || row.film1210) filmRows.push(row);
      }
    }
    let allIssues: IssueRow[] = [];
    try { allIssues = JSON.parse(localStorage.getItem('radcontrack-issue-register') || '[]'); } catch { /* no usable local issues */ }
    const issueRows = allIssues.filter(issue => issue.date >= startKey && issue.date <= endKey).sort((a, b) => a.date.localeCompare(b.date));
    return { filmRows, issueRows };
  }, [startKey, endKey, shared]);

  const film1714 = filmRows.reduce((sum, row) => sum + row.film1714, 0);
  const usageTotals=shared.reduce<Record<string,number>>((totals,row)=>{for(const [item,quantity] of Object.entries(row.quantities as Record<string,number>))totals[item]=(totals[item]||0)+quantity;return totals;},{});
  const breakdown = (row: Tables<'stock_shift_usage'>, item: string) => {
    if (!bottleCapacity(item)) return null;
    const detail = (row.contrast_volumes as Record<string,{administered_ml:number;waste_ml:number}>)[item];
    return <span className="block text-xs text-muted-foreground">{detail ? `${detail.administered_ml} ml administered; ${detail.waste_ml} ml discarded` : 'Earlier total; volume breakdown not recorded'}</span>;
  };
  const film1210 = filmRows.reduce((sum, row) => sum + row.film1210, 0);
  const exportFilmCSV = () => {
    const header = 'Date,Room,Patients printed for,17 x 14 films,12 x 10 films\n';
    const csv = filmRows.map(row => `${row.date},${row.room},${row.patients},${row.film1714},${row.film1210}`).join('\n');
    const url = URL.createObjectURL(new Blob([header + csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `film-report-${startKey}-${endKey}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    {reportError&&<p role="alert" className="text-destructive">Shared report could not load: {reportError}. Browser entries below are incomplete.</p>}
    <Card><CardHeader><CardTitle className="text-base">Shared stock actually used</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-4 mb-4">{Object.entries(usageTotals).filter(([,quantity])=>quantity>0).map(([item,quantity])=><p key={item} className="text-sm"><strong>{catalogue.find(entry=>entry.id===item)?.name||item}:</strong> {stockAmount(item,quantity)} {!bottleCapacity(item)&&roomUnit(item,catalogue.find(entry=>entry.id===item)?.unit||'units')}</p>)}</div><div className="overflow-x-auto"><Table><TableHeader><TableRow>{['Date','Room','Shift','Item','Used','Recorded by'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{shared.flatMap(row=>Object.entries(row.quantities as Record<string,number>).filter(([,quantity])=>quantity>0).map(([item,quantity])=><TableRow key={`${row.date}-${row.room}-${row.shift}-${item}`}><TableCell>{row.date}</TableCell><TableCell>{row.room}</TableCell><TableCell>{row.shift}</TableCell><TableCell>{catalogue.find(entry=>entry.id===item)?.name||item}</TableCell><TableCell>{stockAmount(item,quantity)} {!bottleCapacity(item)&&roomUnit(item,catalogue.find(entry=>entry.id===item)?.unit||'units')}{breakdown(row,item)}</TableCell><TableCell>{row.recorded_by_name}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Shared picks from store</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow>{['Date','Room','Shift','Item','Picked','Picked by'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{sharedMovements.map(row=><TableRow key={row.id}><TableCell>{row.occurred_on}</TableCell><TableCell>{row.destination}</TableCell><TableCell>{row.shift}</TableCell><TableCell>{catalogue.find(entry=>entry.id===row.item_id)?.name||row.item_id}</TableCell><TableCell>{row.quantity} {catalogue.find(entry=>entry.id===row.item_id)?.unit}</TableCell><TableCell>{row.recipient_name}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4" /> Film printing</CardTitle><Button variant="outline" size="sm" onClick={exportFilmCSV} disabled={filmRows.length === 0}><Download className="h-3 w-3 mr-1" />Export film CSV</Button></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-3 mb-4"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">17 × 14 printed</p><p className="text-2xl font-bold">{film1714} <span className="text-sm font-normal">sheets</span></p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">12 × 10 printed</p><p className="text-2xl font-bold">{film1210} <span className="text-sm font-normal">sheets</span></p></div></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Room</TableHead><TableHead className="text-right">Patients printed for</TableHead><TableHead className="text-right">17 × 14</TableHead><TableHead className="text-right">12 × 10</TableHead><TableHead className="text-right">17 × 14 per patient</TableHead><TableHead className="text-right">12 × 10 per patient</TableHead></TableRow></TableHeader><TableBody>{filmRows.length ? filmRows.map(row => <TableRow key={`${row.date}-${row.room}`}><TableCell>{row.date}</TableCell><TableCell>{row.room}</TableCell><TableCell className="text-right">{row.patients}</TableCell><TableCell className="text-right">{row.film1714}</TableCell><TableCell className="text-right">{row.film1210}</TableCell><TableCell className="text-right">{perPatient(row.film1714, row.patients)}</TableCell><TableCell className="text-right">{perPatient(row.film1210, row.patients)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No film printing recorded for this period</TableCell></TableRow>}</TableBody></Table></div>
      </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" /> Store issues</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Quantity issued</TableHead><TableHead className="text-right">Balance after issue</TableHead><TableHead>Confirmed by</TableHead></TableRow></TableHeader><TableBody>{issueRows.length ? issueRows.map(row => <TableRow key={row.id}><TableCell>{row.date}</TableCell><TableCell>{row.itemName}</TableCell><TableCell className="text-right">{row.quantity} {row.unit}</TableCell><TableCell className="text-right">{row.expectedBalance} {row.unit}</TableCell><TableCell>{row.issuedBy}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No store issues recorded for this period</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <p className="text-xs text-muted-foreground">New usage and picks are shared with the team. Earlier film and store entries remain in this browser. Shared film entries take precedence for the same room and shift, so they are not counted twice.</p>
  </div>;
}

