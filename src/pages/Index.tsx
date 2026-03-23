import { useContrastData } from '@/hooks/useContrastData';
import { ShiftSection } from '@/components/ShiftSection';
import { DateSelector } from '@/components/DateSelector';
import { DailySummary } from '@/components/DailySummary';
import { ShiftType, ContrastType, CONTRAST_LABELS } from '@/types/contrast';
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
import { RotateCcw, Loader2, LogOut, Sun, Moon, FileText } from 'lucide-react';
import bthdcLogo from '@/assets/bthdc-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { NavLink } from '@/components/NavLink';

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
    getReceivedValues,
    getAdditionalReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  } = useContrastData();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

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

  const handleMetadataChange = (
    shift: ShiftType,
    field: 'handedOverTo' | 'calculatedBy' | 'attestation',
    value: string | boolean
  ) => {
    updateMetadata(shift, field, value);
  };

  // Calculate stat cards
  const totalReceived = CONTRAST_TYPES.reduce((sum, type) => {
    return sum + data.morning[type].received.mls;
  }, 0);

  const totalConsumed = CONTRAST_TYPES.reduce((sum, type) => {
    return sum + data.morning[type].consumption.mls 
      + data.afternoon[type].consumption.mls 
      + data.night[type].consumption.mls;
  }, 0);

  const totalRemaining = totalReceived - totalConsumed;
  const consumptionPct = totalReceived > 0 ? Math.round((totalConsumed / totalReceived) * 100) : 0;

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
                Radiology Daily Contrast Tracker
              </span>
            </div>

            <div className="flex items-center gap-1">
              <NavLink to="/usage" className="flex items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded-md text-sm transition-colors">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Usage Report</span>
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
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Form Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all data for the selected date. This action cannot be undone.
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
              <h1 className="text-xl font-bold text-foreground">Daily Contrast Consumption</h1>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard 
                label="Total Received" 
                value={`${totalReceived.toLocaleString()}`}
                unit="mls"
              />
              <StatCard 
                label="Total Consumed" 
                value={`${totalConsumed.toLocaleString()}`}
                unit="mls"
                badge={totalReceived > 0 ? `${consumptionPct}%` : undefined}
                badgeVariant={consumptionPct > 80 ? 'warning' : 'default'}
              />
              <StatCard 
                label="Remaining Stock" 
                value={`${totalRemaining.toLocaleString()}`}
                unit="mls"
                badgeVariant={totalRemaining < 0 ? 'danger' : 'success'}
                badge={totalRemaining < 0 ? 'Low' : undefined}
              />
              <StatCard 
                label="Contrast Types" 
                value="4"
                unit="tracked"
              />
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
              {/* Shift Sections */}
              <div className="flex-1 space-y-4 min-w-0">
                {SHIFTS.map((shift) => (
                  <ShiftSection
                    key={shift}
                    shift={shift}
                    shiftData={data[shift]}
                    getReceivedValues={getReceivedValues}
                    getAdditionalReceivedValues={getAdditionalReceivedValues}
                    getOutstandingValues={getOutstandingValues}
                    onReceivedChange={handleReceivedChange}
                    onAdditionalReceivedChange={handleAdditionalReceivedChange}
                    onConsumptionChange={handleConsumptionChange}
                    onMetadataChange={handleMetadataChange}
                  />
                ))}

                {/* Footer Tip */}
                <div className="p-4 dashboard-card">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-medium">Tip:</span> Outstanding Stock = Received - Consumption. 
                    Negative values appear in red. Each shift inherits the previous shift's outstanding stock.
                  </p>
                </div>

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
              <div className="xl:w-80 shrink-0 xl:sticky xl:top-24 xl:self-start">
                <DailySummary data={data} />
              </div>
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
