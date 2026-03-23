import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Plus, Trash2, Download, ArrowLeft, Sun, Moon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';

const MODALITIES = ['CT', 'MRI', 'Fluoroscopy', 'Angiography'] as const;
const CONTRAST_TYPES = [
  { value: 'jodascan300', label: 'Jodascan 300' },
  { value: 'hexopack350', label: 'Hexopack 350' },
  { value: 'gastrolux', label: 'Gastrolux' },
  { value: 'mriContrast', label: 'MRI Contrast' },
] as const;

interface UsageLog {
  id: string;
  date: string;
  shift: string;
  modality: string;
  patient_number: string;
  contrast_type: string;
  volume_ml: number;
}

const ContrastUsage = () => {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterContrast, setFilterContrast] = useState<string>('all');

  // New entry form
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newModality, setNewModality] = useState<string>('CT');
  const [newPatientNumber, setNewPatientNumber] = useState('');
  const [newContrastType, setNewContrastType] = useState<string>('jodascan300');
  const [newVolume, setNewVolume] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contrast_usage_logs')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filterDate) {
      query = query.eq('date', format(filterDate, 'yyyy-MM-dd'));
    }
    if (filterContrast && filterContrast !== 'all') {
      query = query.eq('contrast_type', filterContrast);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: 'Failed to load usage logs', variant: 'destructive' });
    } else {
      setLogs((data as UsageLog[]) || []);
    }
    setLoading(false);
  }, [filterDate, filterContrast, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAdd = async () => {
    if (!newPatientNumber.trim() || !newVolume.trim()) {
      toast({ title: 'Missing fields', description: 'Patient number and volume are required', variant: 'destructive' });
      return;
    }
    const vol = parseFloat(newVolume);
    if (isNaN(vol) || vol <= 0) {
      toast({ title: 'Invalid volume', description: 'Volume must be a positive number', variant: 'destructive' });
      return;
    }

    setAdding(true);
    const { error } = await supabase.from('contrast_usage_logs').insert({
      date: format(newDate, 'yyyy-MM-dd'),
      modality: newModality,
      patient_number: newPatientNumber.trim(),
      contrast_type: newContrastType,
      volume_ml: Math.round(vol * 10) / 10,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to add entry', variant: 'destructive' });
    } else {
      setNewPatientNumber('');
      setNewVolume('');
      fetchLogs();
      toast({ title: 'Entry added' });
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('contrast_usage_logs').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete entry', variant: 'destructive' });
    } else {
      fetchLogs();
    }
  };

  const totalVolume = logs.reduce((sum, l) => sum + Number(l.volume_ml), 0);

  const exportCSV = () => {
    if (logs.length === 0) return;
    const header = 'Date,Modality,Patient Number,Contrast Type,Volume (ml)\n';
    const rows = logs.map(l => {
      const ctLabel = CONTRAST_TYPES.find(c => c.value === l.contrast_type)?.label || l.contrast_type;
      return `${l.date},${l.modality},${l.patient_number},${ctLabel},${l.volume_ml}`;
    }).join('\n');
    const totalRow = `\nTotal,,,,${Math.round(totalVolume * 10) / 10}`;
    const blob = new Blob([header + rows + totalRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrast-usage-${filterDate ? format(filterDate, 'yyyy-MM-dd') : 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contrastLabel = (val: string) => CONTRAST_TYPES.find(c => c.value === val)?.label || val;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <NavLink to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
              </NavLink>
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Contrast Usage Report</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Add Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Log Contrast Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-full justify-start text-left font-normal text-xs')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {format(newDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Modality</label>
                <Select value={newModality} onValueChange={setNewModality}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Patient #</label>
                <Input className="h-9 text-xs" placeholder="e.g. PT001" value={newPatientNumber} onChange={e => setNewPatientNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contrast Type</label>
                <Select value={newContrastType} onValueChange={setNewContrastType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRAST_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Volume (ml)</label>
                <Input className="h-9 text-xs" type="number" min="0" step="0.1" placeholder="ml" value={newVolume} onChange={e => setNewVolume(e.target.value)} />
              </div>
              <Button size="sm" className="h-9" onClick={handleAdd} disabled={adding}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Filter by Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal text-xs', !filterDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {filterDate ? format(filterDate, 'dd/MM/yyyy') : 'All dates'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterDate} onSelect={setFilterDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Filter by Contrast</label>
                <Select value={filterContrast} onValueChange={setFilterContrast}>
                  <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {CONTRAST_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(filterDate || filterContrast !== 'all') && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterDate(undefined); setFilterContrast('all'); }}>
                  Clear Filters
                </Button>
              )}
              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={logs.length === 0}>
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Modality</TableHead>
                  <TableHead className="text-xs">Patient #</TableHead>
                  <TableHead className="text-xs">Contrast Type</TableHead>
                  <TableHead className="text-xs text-right">Volume (ml)</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries found</TableCell></TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{log.date}</TableCell>
                      <TableCell className="text-xs font-medium">{log.modality}</TableCell>
                      <TableCell className="text-xs">{log.patient_number}</TableCell>
                      <TableCell className="text-xs">{contrastLabel(log.contrast_type)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{Number(log.volume_ml).toFixed(1)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(log.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {logs.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-xs font-bold">Total</TableCell>
                    <TableCell className="text-xs text-right font-bold font-mono">{totalVolume.toFixed(1)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground italic" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Designed and Built by Pistis
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            ©2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContrastUsage;
