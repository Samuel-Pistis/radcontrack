import { ShiftMetadata as ShiftMetadataType } from '@/types/contrast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { UserCheck, Calculator, ClipboardCheck } from 'lucide-react';

interface ShiftMetadataProps {
  metadata: ShiftMetadataType;
  onHandedOverToChange: (value: string) => void;
  onCalculatedByChange: (value: string) => void;
  onAttestationChange: (value: boolean) => void;
}

const STAFF_OPTIONS = [
  'Dr. Smith',
  'Dr. Johnson',
  'Dr. Williams',
  'Nurse Davis',
  'Nurse Miller',
  'Tech. Anderson',
  'Tech. Taylor',
];

export const ShiftMetadata = ({
  metadata,
  onHandedOverToChange,
  onCalculatedByChange,
  onAttestationChange,
}: ShiftMetadataProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-border mt-4">
      {/* Handed Over To */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UserCheck className="h-4 w-4 text-primary" />
          Handed Over To
        </Label>
        <select
          value={metadata.handedOverTo}
          onChange={(e) => onHandedOverToChange(e.target.value)}
          className="clinical-input w-full"
        >
          <option value="">Select staff member...</option>
          {STAFF_OPTIONS.map((staff) => (
            <option key={staff} value={staff}>
              {staff}
            </option>
          ))}
        </select>
      </div>

      {/* Calculated By */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calculator className="h-4 w-4 text-primary" />
          Calculated By
        </Label>
        <select
          value={metadata.calculatedBy}
          onChange={(e) => onCalculatedByChange(e.target.value)}
          className="clinical-input w-full"
        >
          <option value="">Select staff member...</option>
          {STAFF_OPTIONS.map((staff) => (
            <option key={staff} value={staff}>
              {staff}
            </option>
          ))}
        </select>
      </div>

      {/* Attestation */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Verification
        </Label>
        <div className="flex items-center space-x-2 h-9 px-3 bg-background rounded-md border border-input">
          <Checkbox
            id="attestation"
            checked={metadata.attestation}
            onCheckedChange={(checked) => onAttestationChange(checked === true)}
          />
          <label
            htmlFor="attestation"
            className="text-sm font-medium leading-none cursor-pointer select-none"
          >
            I attest to the correctness of this data
          </label>
        </div>
      </div>
    </div>
  );
};
