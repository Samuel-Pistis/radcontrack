import { useContrastData } from '@/hooks/useContrastData';
import { ShiftSection } from '@/components/ShiftSection';
import { DateSelector } from '@/components/DateSelector';
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
import { RotateCcw, FlaskConical, Activity } from 'lucide-react';

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
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <FlaskConical className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Radiology Contrast Tracker
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Daily Consumption Chart
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <DateSelector
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden sm:inline">Reset Form</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-popover">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Form Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all data for the selected date. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resetForm}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
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
        <div className="mt-8 p-4 bg-accent/30 rounded-lg border border-accent">
          <p className="text-sm text-accent-foreground">
            <strong>Note:</strong> Outstanding Stock is automatically calculated as (Total Qty Received - Total Consumption). 
            Negative values are highlighted in red. Afternoon and Night shifts automatically inherit the Outstanding Stock 
            from the previous shift as their Total Qty Received.
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
