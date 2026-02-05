import { useContrastData } from '@/hooks/useContrastData';
import { ShiftSection } from '@/components/ShiftSection';
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
import { RotateCcw, FlaskConical } from 'lucide-react';

const SHIFTS: ShiftType[] = ['morning', 'afternoon', 'night'];

export const Dashboard = () => {
  const {
    selectedDate,
    setSelectedDate,
    data,
    updateReceived,
    updateConsumption,
    getReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  } = useContrastData();

  const handleReceivedChange = (
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    updateReceived(shift, contrastType, field, value);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/15 rounded-xl">
                <FlaskConical className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Contrast Tracker
                </h1>
                <p className="text-xs text-muted-foreground">
                  Daily Consumption Chart
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
                  <AlertDialogCancel className="bg-secondary hover:bg-secondary/80">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetForm} className="bg-destructive hover:bg-destructive/90">
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Date Selector */}
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Daily Summary Chart */}
        <div className="mb-6">
          <DailySummary data={data} />
        </div>

        <div className="space-y-4">
          {SHIFTS.map((shift) => (
            <ShiftSection
              key={shift}
              shift={shift}
              shiftData={data[shift]}
              getReceivedValues={getReceivedValues}
              getOutstandingValues={getOutstandingValues}
              onReceivedChange={handleReceivedChange}
              onConsumptionChange={handleConsumptionChange}
              onMetadataChange={handleMetadataChange}
            />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-card rounded-2xl border border-border/50">
          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-medium">Tip:</span> Outstanding Stock = Received - Consumption. 
            Negative values appear in red. Each shift inherits the previous shift's outstanding stock.
          </p>
        </div>
      </main>
    </div>
  );
};

const Index = () => {
  return <Dashboard />;
};

export default Index;
