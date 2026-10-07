import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RotateCcw } from 'lucide-react';
import { useContrastData } from '@/hooks/useContrastData';
import { AppNavigation } from '@/components/AppNavigation';
import { ShiftSection } from '@/components/ShiftSection';
import { DateSelector } from '@/components/DateSelector';
import { DailySummary } from '@/components/DailySummary';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { ShiftType } from '@/types/contrast';

export const Dashboard = () => {
  const {selectedDate,setSelectedDate,data,isLoading,updateReceived,updateAdditionalReceived,updateConsumption,updatePatients,getReceivedValues,getAdditionalReceivedValues,getOutstandingValues,updateMetadata,resetForm}=useContrastData();
  const [shift,setShift]=useState<ShiftType>('morning');
  return <div className="min-h-screen bg-background"><AppNavigation />
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
      <div><h1 className="text-2xl font-bold">Clinical contrast record</h1><p className="text-muted-foreground mt-1 max-w-prose">Record clinical volumes and patient counts here. This record does not deduct shared stock. Record actual stock used on the <Link className="text-primary underline" to="/">Daily usage page</Link>.</p></div>
      <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <fieldset><legend className="text-sm font-medium mb-2">Shift</legend><div className="flex flex-wrap gap-2">{(['morning','afternoon','night'] as const).map(value=><Button key={value} aria-pressed={shift===value} variant={shift===value?'default':'outline'} className="capitalize" onClick={()=>setShift(value)}>{value}</Button>)}</div></fieldset>
      {isLoading?<p role="status" className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading clinical record…</p>:<ShiftSection shift={shift} shiftData={data[shift]} getReceivedValues={getReceivedValues} getAdditionalReceivedValues={getAdditionalReceivedValues} getOutstandingValues={getOutstandingValues} onReceivedChange={updateReceived} onAdditionalReceivedChange={updateAdditionalReceived} onConsumptionChange={updateConsumption} onPatientsChange={updatePatients} onMetadataChange={updateMetadata} />}
      <details className="border-t pt-4"><summary className="cursor-pointer font-medium">Clinical daily summary</summary><div className="mt-4"><DailySummary data={data} /></div></details>
      <details className="border-t pt-4"><summary className="cursor-pointer text-sm text-muted-foreground">Reset clinical entries for this date</summary><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="mt-3"><RotateCcw className="w-4 h-4 mr-2" />Reset clinical entries</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset clinical entries?</AlertDialogTitle><AlertDialogDescription>This clears clinical contrast entries for the selected date. Shared stock usage, film records and store records remain in place.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={resetForm}>Reset clinical entries</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></details>
    </main>
  </div>;
};
export default Dashboard;