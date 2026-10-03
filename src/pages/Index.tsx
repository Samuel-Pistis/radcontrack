import { useContrastData } from '@/hooks/useContrastData';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ShiftSection } from '@/components/ShiftSection';
import { FilmUsageSection } from '@/components/FilmUsageSection';
import { RoomUsageSection } from '@/components/RoomUsageSection';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { DateSelector } from '@/components/DateSelector';
import { DailySummary } from '@/components/DailySummary';
import { ShiftType, ContrastType } from '@/types/contrast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RotateCcw, Loader2, LogOut, Sun, Moon, FileText, TrendingUp, Boxes } from 'lucide-react';
import bthdcLogo from '@/assets/bthdc-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { NavLink } from '@/components/NavLink';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SHIFTS: ShiftType[] = ['morning', 'afternoon', 'night'];
const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];

export const Dashboard = () => {
  const {
    selectedDate,
    setSelectedDate,
    data,
    isLoading,
    updateReceived,
    updateAdditionalReceived,
    updateConsumption,
    updatePatients,
    getReceivedValues,
    getAdditionalReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  } = useContrastData();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeShift, setActiveShift] = useState<ShiftType>('morning');
  const [activeCategory, setActiveCategory] = useState<'contrast' | 'films' | 'supplies'>('contrast');
  const [sharedFilms,setSharedFilms] = useState<Tables<'stock_shift_usage'>[]>([]);
  const [filmLoadError,setFilmLoadError]=useState('');
  const [filmRevision, setFilmRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setFilmRevision(value => value + 1);
    window.addEventListener('radcontrack:film-updated', refresh);
    return () => window.removeEventListener('radcontrack:film-updated', refresh);
  }, []);

  const handleReceivedChange = (
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    updateReceived(shift, contrastType, field, value);
  };

  const handleAdditionalReceivedChange = (
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    updateAdditionalReceived(shift, contrastType, field, value);
  };

  const handleConsumptionChange = (
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    updateConsumption(shift, contrastType, field, value);
  };

  const handlePatientsChange = (
    shift: ShiftType,
    contrastType: ContrastType,
    value: number
  ) => {
    updatePatients(shift, contrastType, value);
  };

  const handleMetadataChange = (
    shift: ShiftType,
    field: 'handedOverTo' | 'calculatedBy' | 'attestation',
    value: string | boolean
  ) => {
    updateMetadata(shift, field, value);
  };

  // Calculate stat cards
  const totalConsumed = CONTRAST_TYPES.reduce((sum, type) => {
    return sum + data.morning[type].consumption.mls 
      + data.afternoon[type].consumption.mls 
      + data.night[type].consumption.mls;
  }, 0);

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  useEffect(()=>{
    let active=true;
    setSharedFilms([]);
    void supabase.from('stock_shift_usage').select('*').eq('date',dateKey).eq('category','films').then(result=>{if(active){setFilmLoadError(result.error?'Shared film totals could not load. Displayed browser totals may be incomplete.':'');if(result.data)setSharedFilms(result.data);}});
    return ()=>{active=false;};
  },[dateKey,filmRevision]);
  const filmTotals = SHIFTS.reduce((totals, shift) => {
    let saved: Record<string, Record<string, number>> = {};
    try { saved = JSON.parse(localStorage.getItem(`radcontrack-film-${dateKey}-${shift}`) || '{}'); } catch { /* leave totals unchanged */ }
    const shared=sharedFilms.filter(row=>row.date===dateKey&&row.shift===shift);
    for (const [roomName,room] of Object.entries(saved)) {
      if(shared.some(row=>row.room===roomName))continue;
      totals.film1714 += Number(room['17 × 14']) || 0;
      totals.film1210 += Number(room['12 × 10']) || 0;
    }
    for(const row of shared){const values=row.quantities as Record<string,number>;totals.film1714+=values.film1714||0;totals.film1210+=values.film1210||0;}
    return totals;
  }, { film1714: 0, film1210: 0 });
  void filmRevision;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="dashboard-nav sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src={bthdcLogo} 
                alt="BTHDC Logo" 
                className="h-9 w-9 object-contain rounded-lg bg-white/10 p-0.5"
              />
              <span className="text-base font-bold tracking-tight text-white">
                Radiology Operations & Inventory
              </span>
            </div>

            <div className="flex items-center gap-1">
              <NavLink to="/" className="hidden md:flex items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-colors">
                Daily Log
              </NavLink>
              <NavLink to="/stock" className="flex items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-colors">
                <Boxes className="h-4 w-4" />
                <span className="hidden sm:inline">Store & Stock</span>
              </NavLink>
              <NavLink to="/usage" className="flex items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-colors">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </NavLink>
              <NavLink to="/weekly-trend" className="flex items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-colors">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Contrast trends</span>
              </NavLink>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Reset contrast</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset contrast entries?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears contrast entries for the selected date. Film and store records remain in place.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resetForm} className="bg-destructive hover:bg-destructive/90">
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-header with greeting and date */}
      <div className="bg-card border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm text-muted-foreground">BT Health & Diagnostics Centre</p>
              <h1 className="text-xl font-bold text-foreground">Daily Operations</h1>
            </div>
          </div>
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading data...</span>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            {filmLoadError&&<p role="alert" className="text-destructive mb-3">{filmLoadError}</p>}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard 
                label="Contrast administered"
                value={`${totalConsumed.toLocaleString()}`}
                unit="ml"
              />
              <StatCard 
                label="17 × 14 films printed"
                value={`${filmTotals.film1714.toLocaleString()}`}
                unit="sheets"
              />
              <StatCard 
                label="12 × 10 films printed"
                value={`${filmTotals.film1210.toLocaleString()}`}
                unit="sheets"
              />
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
              {/* Shift Sections */}
              <div className="flex-1 space-y-4 min-w-0">
                <div className="dashboard-card p-4">
                  <p className="text-sm font-semibold mb-3">Select shift</p>
                  <div className="flex flex-wrap gap-2">
                    {SHIFTS.map(shift => <Button key={shift} variant={activeShift === shift ? 'default' : 'outline'} onClick={() => setActiveShift(shift)} className="capitalize">{shift}</Button>)}
                  </div>
                </div>
                {SHIFTS.filter(shift => shift === activeShift).map((shift) => (
                  <div key={shift} className="space-y-3">
                    <Tabs value={activeCategory} onValueChange={value => setActiveCategory(value as 'contrast' | 'films' | 'supplies')} className="space-y-3">
                      <TabsList className="grid grid-cols-3 w-full"><TabsTrigger value="contrast">Contrast mls</TabsTrigger><TabsTrigger value="films">Films</TabsTrigger><TabsTrigger value="supplies">Stock used</TabsTrigger></TabsList>
                      <TabsContent value="contrast">
                    <p className="text-sm text-muted-foreground mb-3">This clinical record tracks administered millilitres. Enter actual administered and discarded ml under Stock used to update room balances. These figures are kept separate to avoid estimating stock from rounded volumes.</p>
                    <ShiftSection
                      shift={shift}
                      shiftData={data[shift]}
                      getReceivedValues={getReceivedValues}
                      getAdditionalReceivedValues={getAdditionalReceivedValues}
                      getOutstandingValues={getOutstandingValues}
                      onReceivedChange={handleReceivedChange}
                      onAdditionalReceivedChange={handleAdditionalReceivedChange}
                      onConsumptionChange={handleConsumptionChange}
                      onPatientsChange={handlePatientsChange}
                      onMetadataChange={handleMetadataChange}
                    />
                      </TabsContent>
                      <TabsContent value="supplies"><RoomUsageSection key={`${dateKey}-${shift}-supplies`} shift={shift} date={selectedDate} category="supplies" /></TabsContent>
                      <TabsContent value="films">
                    <FilmUsageSection key={`${selectedDate.toDateString()}-${shift}`} shift={shift} date={selectedDate} />
                      </TabsContent>
                    </Tabs>
                  </div>
                ))}

                {/* Footer Tip */}
                {activeCategory === 'contrast' && <div className="p-4 dashboard-card">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-medium">Tip:</span> Outstanding Stock = Received - Consumption. 
                    Negative values appear in red. Each shift inherits the previous shift's outstanding stock.
                  </p>
                </div>}

                {/* Footer Credit */}
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground italic" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    Designed and Built by Pistis
                  </p>
                  <p className="text-xs text-muted-foreground/70 italic mt-0.5" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                    ©2026
                  </p>
                </div>
              </div>

              {/* Summary Sidebar */}
              {activeCategory === 'contrast' && <div className="xl:w-80 shrink-0 xl:sticky xl:top-24 xl:self-start">
                <DailySummary data={data} />
              </div>}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatCard = ({ label, value, unit, badge, badgeVariant = 'default' }: StatCardProps) => {
  const badgeColors = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
  };

  return (
    <div className="dashboard-card p-4 flex flex-col gap-1">
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {badge && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColors[badgeVariant]}`}>
            {badge}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{unit}</span>
      <span className="text-sm font-medium text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
};

const Index = () => {
  return <Dashboard />;
};

export default Index;

