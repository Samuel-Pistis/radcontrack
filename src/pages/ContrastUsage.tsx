import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Download, ArrowLeft, Sun, Moon, FileText, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { ContrastType, ShiftType, DailyData, CONTRAST_LABELS } from '@/types/contrast';

type RangeMode = 'week' | 'month' | 'custom';

const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];
const SHIFTS: ShiftType[] = ['morning', 'afternoon', 'night'];

interface DailyRow {
  date: string;
  contrastType: string;
  contrastLabel: string;
  totalMls: number;
  totalBottles: number;
  totalPatients: number;
}

const ContrastUsage = () => {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [filterContrast, setFilterContrast] = useState<string>('all');
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom range
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  const getDateRange = useCallback((): { start: Date; end: Date } => {
    if (rangeMode === 'week') {
      return {
        start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
    }
    if (rangeMode === 'month') {
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
      };
    }
    // custom
    return {
      start: customStart || new Date(),
      end: customEnd || new Date(),
    };
  }, [rangeMode, referenceDate, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const startKey = format(start, 'yyyy-MM-dd');
    const endKey = format(end, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('daily_contrast_data')
      .select('date, data')
      .gte('date', startKey)
      .lte('date', endKey)
      .order('date', { ascending: true });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const result: DailyRow[] = [];

    (data || []).forEach((record) => {
      const dailyData = record.data as unknown as DailyData;
      if (!dailyData) return;

      CONTRAST_TYPES.forEach((ct) => {
        let totalMls = 0;
        let totalBottles = 0;
        let totalPatients = 0;

        SHIFTS.forEach((shift) => {
          const shiftData = dailyData[shift];
          if (shiftData && shiftData[ct]) {
            totalMls += Number(shiftData[ct].consumption?.mls || 0);
            totalBottles += Number(shiftData[ct].consumption?.bottles || 0);
            totalPatients += Number(shiftData[ct].patients || 0);
          }
        });

        if (totalMls > 0 || totalBottles > 0 || totalPatients > 0) {
          result.push({
            date: record.date,
            contrastType: ct,
            contrastLabel: CONTRAST_LABELS[ct],
            totalMls: Math.round(totalMls * 10) / 10,
            totalBottles: Math.round(totalBottles * 10) / 10,
            totalPatients,
          });
        }
      });
    });

    // Apply contrast filter
    const filtered = filterContrast === 'all'
      ? result
      : result.filter(r => r.contrastType === filterContrast);

    setRows(filtered);
    setLoading(false);
  }, [getDateRange, filterContrast, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grandTotalMls = Math.round(rows.reduce((s, r) => s + r.totalMls, 0) * 10) / 10;
  const grandTotalBottles = Math.round(rows.reduce((s, r) => s + r.totalBottles, 0) * 10) / 10;
  const grandTotalPatients = rows.reduce((s, r) => s + r.totalPatients, 0);

  // Summary by contrast type
  const summaryByType = CONTRAST_TYPES.map(ct => {
    const typeRows = rows.filter(r => r.contrastType === ct);
    return {
      type: ct,
      label: CONTRAST_LABELS[ct],
      totalMls: Math.round(typeRows.reduce((s, r) => s + r.totalMls, 0) * 10) / 10,
      totalBottles: Math.round(typeRows.reduce((s, r) => s + r.totalBottles, 0) * 10) / 10,
      totalPatients: typeRows.reduce((s, r) => s + r.totalPatients, 0),
    };
  }).filter(s => s.totalMls > 0 || s.totalBottles > 0 || s.totalPatients > 0);

  const { start, end } = getDateRange();
  const rangeLabel = `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`;

  const exportCSV = () => {
    if (rows.length === 0) return;
    const header = 'Date,Contrast Type,Volume (ml),Bottles,Patients\n';
    const csvRows = rows.map(r => `${r.date},${r.contrastLabel},${r.totalMls},${r.totalBottles},${r.totalPatients}`).join('\n');
    const totalRow = `\nTotal,,${grandTotalMls},${grandTotalBottles},${grandTotalPatients}`;
    const blob = new Blob([header + csvRows + totalRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrast-report-${format(start, 'yyyyMMdd')}-${format(end, 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
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
        {/* Date Range Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Period</label>
                <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as RangeMode)}>
                  <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rangeMode !== 'custom' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reference Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-[160px] justify-start text-left font-normal text-xs">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(referenceDate, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={referenceDate} onSelect={(d) => d && setReferenceDate(d)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {rangeMode === 'custom' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal text-xs', !customStart && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {customStart ? format(customStart, 'dd/MM/yyyy') : 'Pick start'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal text-xs', !customEnd && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Pick end'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contrast Type</label>
                <Select value={filterContrast} onValueChange={setFilterContrast}>
                  <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {CONTRAST_TYPES.map(ct => (
                      <SelectItem key={ct} value={ct}>{CONTRAST_LABELS[ct]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
            </p>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {summaryByType.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summaryByType.map(s => (
              <Card key={s.type}>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{s.totalMls} <span className="text-xs font-normal text-muted-foreground">ml</span></p>
                  <p className="text-xs text-muted-foreground">{s.totalBottles} bottles · {s.totalPatients} patients</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Contrast Type</TableHead>
                  <TableHead className="text-xs text-right">Volume (ml)</TableHead>
                  <TableHead className="text-xs text-right">Bottles</TableHead>
                  <TableHead className="text-xs text-right">Patients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No consumption data for this period</TableCell></TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow key={`${row.date}-${row.contrastType}-${i}`}>
                      <TableCell className="text-xs">{row.date}</TableCell>
                      <TableCell className="text-xs font-medium">{row.contrastLabel}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{row.totalMls.toFixed(1)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{row.totalBottles.toFixed(1)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{row.totalPatients}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs font-bold">Grand Total</TableCell>
                    <TableCell className="text-xs text-right font-bold font-mono">{grandTotalMls.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-right font-bold font-mono">{grandTotalBottles.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-right font-bold font-mono">{grandTotalPatients}</TableCell>
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
