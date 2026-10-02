import { useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Film, Boxes } from 'lucide-react';

const ROOMS = ['X-ray', 'CT', 'MRI', 'Fluoroscopy'];
const SHIFTS = ['morning', 'afternoon', 'night'];
type FilmRow = { date: string; room: string; patients: number; film1714: number; film1210: number };
type IssueRow = { id: string; date: string; itemName: string; quantity: number; unit: string; expectedBalance: number; issuedBy: string };

export function FilmAndStoreReport({ start, end }: { start: Date; end: Date }) {
  const startKey = format(start, 'yyyy-MM-dd');
  const endKey = format(end, 'yyyy-MM-dd');
  const { filmRows, issueRows } = useMemo(() => {
    const filmRows: FilmRow[] = [];
    const dates = new Set<string>();
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
          row.patients += Number(saved[room]?.patients) || 0;
          row.film1714 += Number(saved[room]?.['17 × 14']) || 0;
          row.film1210 += Number(saved[room]?.['12 × 10']) || 0;
        }
        if (row.patients || row.film1714 || row.film1210) filmRows.push(row);
      }
    }
    let allIssues: IssueRow[] = [];
    try { allIssues = JSON.parse(localStorage.getItem('radcontrack-issue-register') || '[]'); } catch { /* no usable local issues */ }
    const issueRows = allIssues.filter(issue => issue.date >= startKey && issue.date <= endKey).sort((a, b) => a.date.localeCompare(b.date));
    return { filmRows, issueRows };
  }, [startKey, endKey]);

  const film1714 = filmRows.reduce((sum, row) => sum + row.film1714, 0);
  const film1210 = filmRows.reduce((sum, row) => sum + row.film1210, 0);
  const exportFilmCSV = () => {
    const header = 'Date,Room,Patients printed for,17 x 14 films,12 x 10 films\n';
    const csv = filmRows.map(row => `${row.date},${row.room},${row.patients},${row.film1714},${row.film1210}`).join('\n');
    const url = URL.createObjectURL(new Blob([header + csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `film-report-${startKey}-${endKey}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4" /> Film printing</CardTitle><Button variant="outline" size="sm" onClick={exportFilmCSV} disabled={filmRows.length === 0}><Download className="h-3 w-3 mr-1" />Export film CSV</Button></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-3 mb-4"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">17 × 14 printed</p><p className="text-2xl font-bold">{film1714} <span className="text-sm font-normal">sheets</span></p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">12 × 10 printed</p><p className="text-2xl font-bold">{film1210} <span className="text-sm font-normal">sheets</span></p></div></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Room</TableHead><TableHead className="text-right">Patients printed for</TableHead><TableHead className="text-right">17 × 14</TableHead><TableHead className="text-right">12 × 10</TableHead></TableRow></TableHeader><TableBody>{filmRows.length ? filmRows.map(row => <TableRow key={`${row.date}-${row.room}`}><TableCell>{row.date}</TableCell><TableCell>{row.room}</TableCell><TableCell className="text-right">{row.patients}</TableCell><TableCell className="text-right">{row.film1714}</TableCell><TableCell className="text-right">{row.film1210}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No film printing recorded for this period</TableCell></TableRow>}</TableBody></Table></div>
      </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Boxes className="h-4 w-4" /> Store issues</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Quantity issued</TableHead><TableHead className="text-right">Balance after issue</TableHead><TableHead>Confirmed by</TableHead></TableRow></TableHeader><TableBody>{issueRows.length ? issueRows.map(row => <TableRow key={row.id}><TableCell>{row.date}</TableCell><TableCell>{row.itemName}</TableCell><TableCell className="text-right">{row.quantity} {row.unit}</TableCell><TableCell className="text-right">{row.expectedBalance} {row.unit}</TableCell><TableCell>{row.issuedBy}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No store issues recorded for this period</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <p className="text-xs text-muted-foreground">Film printing and store issue records shown here are saved in this browser. Contrast records use the signed-in account.</p>
  </div>;
}
