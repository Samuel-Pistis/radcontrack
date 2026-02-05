import { useState } from 'react';
import { ShiftType, ContrastType, SHIFT_LABELS, SHIFT_TIMES, ShiftData } from '@/types/contrast';
import { ContrastTable } from './ContrastTable';
import { ShiftMetadata } from './ShiftMetadata';
import { ChevronDown, Sun, Sunset, Moon } from 'lucide-react';

interface ShiftSectionProps {
  shift: ShiftType;
  shiftData: ShiftData;
  getReceivedValues: (shift: ShiftType, contrastType: ContrastType) => { mls: number; bottles: number };
  getOutstandingValues: (shift: ShiftType, contrastType: ContrastType) => { mls: number; bottles: number };
  onReceivedChange: (shift: ShiftType, contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onConsumptionChange: (shift: ShiftType, contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onMetadataChange: (shift: ShiftType, field: 'handedOverTo' | 'calculatedBy' | 'attestation', value: string | boolean) => void;
}

const shiftIcons: Record<ShiftType, React.ReactNode> = {
  morning: <Sun className="h-5 w-5" />,
  afternoon: <Sunset className="h-5 w-5" />,
  night: <Moon className="h-5 w-5" />,
};

const shiftHeaderStyles: Record<ShiftType, string> = {
  morning: 'shift-morning',
  afternoon: 'shift-afternoon',
  night: 'shift-night',
};

export const ShiftSection = ({
  shift,
  shiftData,
  getReceivedValues,
  getOutstandingValues,
  onReceivedChange,
  onConsumptionChange,
  onMetadataChange,
}: ShiftSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isMorning = shift === 'morning';

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-lg shadow-black/5 overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-5 ${shiftHeaderStyles[shift]} transition-all duration-200 hover:bg-secondary/30`}
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            {shiftIcons[shift]}
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-foreground">{SHIFT_LABELS[shift]}</h2>
            <p className="text-sm text-muted-foreground">{SHIFT_TIMES[shift]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {shiftData.metadata.attestation && (
            <span className="px-3 py-1.5 text-xs font-medium bg-primary/15 text-primary rounded-full">
              ✓ Verified
            </span>
          )}
          <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          <ContrastTable
            shift={shift}
            isMorning={isMorning}
            getReceivedValues={getReceivedValues}
            getOutstandingValues={getOutstandingValues}
            consumption={{
              jodascan300: shiftData.jodascan300.consumption,
              hexopack350: shiftData.hexopack350.consumption,
              gastrolux: shiftData.gastrolux.consumption,
              mriContrast: shiftData.mriContrast.consumption,
            }}
            onReceivedChange={(type, field, value) => onReceivedChange(shift, type, field, value)}
            onConsumptionChange={(type, field, value) => onConsumptionChange(shift, type, field, value)}
          />

          <ShiftMetadata
            metadata={shiftData.metadata}
            onHandedOverToChange={(value) => onMetadataChange(shift, 'handedOverTo', value)}
            onCalculatedByChange={(value) => onMetadataChange(shift, 'calculatedBy', value)}
            onAttestationChange={(value) => onMetadataChange(shift, 'attestation', value)}
          />
        </div>
      )}
    </div>
  );
};
