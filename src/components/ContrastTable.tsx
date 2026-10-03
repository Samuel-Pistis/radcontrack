import { clinicalBottleCapacity, contrastEquivalent } from '@/lib/contrastVolume';
import { ShiftType, ContrastType, CONTRAST_LABELS, ContrastValues } from '@/types/contrast';
import { Plus } from 'lucide-react';

interface ContrastTableProps {
  shift: ShiftType;
  isMorning: boolean;
  getReceivedValues: (shift: ShiftType, contrastType: ContrastType) => ContrastValues;
  getAdditionalReceivedValues: (shift: ShiftType, contrastType: ContrastType) => ContrastValues;
  getOutstandingValues: (shift: ShiftType, contrastType: ContrastType) => ContrastValues;
  consumption: Record<ContrastType, ContrastValues>;
  patients: Record<ContrastType, number>;
  onReceivedChange: (contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onAdditionalReceivedChange: (contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onConsumptionChange: (contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onPatientsChange: (contrastType: ContrastType, value: number) => void;
}

const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];

export const ContrastTable = ({
  shift,
  isMorning,
  getReceivedValues,
  getAdditionalReceivedValues,
  getOutstandingValues,
  consumption,
  patients,
  onReceivedChange,
  onAdditionalReceivedChange,
  onConsumptionChange,
  onPatientsChange,
}: ContrastTableProps) => {
  const renderValueCell = (
    value: number,
    isNegative: boolean,
    isReadOnly: boolean = false
  ) => {
    if (isReadOnly) {
      return (
        <span className={`font-semibold ${isNegative ? 'stock-negative' : 'stock-positive'}`}>
          {value}
        </span>
      );
    }
    return value;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">CT: 100 ml per bottle. MRI: 15 ml per bottle. Bottle equivalents calculate from ml; fractional equivalents do not mean a whole bottle was opened.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-3 text-left text-sm font-semibold text-foreground border-b border-border min-w-[140px]">
                Row Type
              </th>
              {CONTRAST_TYPES.map((type) => (
                <th
                  key={type}
                  colSpan={2}
                  className="p-3 text-center text-sm font-semibold text-foreground border-b border-border border-l"
                >
                  {CONTRAST_LABELS[type]}
                </th>
              ))}
            </tr>
            <tr className="bg-muted/30">
              <th className="p-2 text-left text-xs font-medium text-muted-foreground border-b border-border">
                &nbsp;
              </th>
              {CONTRAST_TYPES.map((type) => (
                <>
                  <th
                    key={`${type}-mls`}
                    className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border border-l"
                  >
                    Total (mls)
                  </th>
                  <th
                    key={`${type}-bottles`}
                    className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border"
                  >
                    Bottle equivalent
                  </th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total Qty Received Row */}
            <tr className="hover:bg-muted/20 transition-colors">
              <td className="p-3 text-sm font-medium text-foreground border-b border-border">
                Total Qty Received
                {!isMorning && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    (Carried over + Additional)
                  </span>
                )}
              </td>
              {CONTRAST_TYPES.map((type) => {
                const received = getReceivedValues(shift, type);
                const additional = getAdditionalReceivedValues(shift, type);
                const hasAdditional = !isMorning && (additional.mls > 0 || additional.bottles > 0);
                return (
                  <>
                    <td key={`${type}-received-mls`} className="p-2 border-b border-border border-l">
                      {isMorning ? (
                        <input
                          type="number"
                          min="0"
                          max={100000}
                          value={received.mls || ''}
                          onChange={(e) => onReceivedChange(type, 'mls', Number(e.target.value) || 0)}
                          className="clinical-input text-center"
                          placeholder="0"
                        />
                      ) : (
                        <div className={`clinical-input clinical-input-readonly text-center ${hasAdditional ? 'text-primary font-semibold' : ''}`}>
                          {received.mls}
                          {hasAdditional && <Plus className="inline h-3 w-3 ml-0.5 text-primary" />}
                        </div>
                      )}
                    </td>
                    <td key={`${type}-received-bottles`} className="p-2 border-b border-border">
                      {isMorning ? (
                        <input
                          type="number"
                          min="0"
                          max={1000}
                          readOnly={clinicalBottleCapacity(type)>0} value={(clinicalBottleCapacity(type)>0 ? Number(contrastEquivalent(type,received.mls).toFixed(3)) : received.bottles) || ''}
                          onChange={(e) => onReceivedChange(type, 'bottles', Number(e.target.value) || 0)}
                          className="clinical-input text-center"
                          placeholder="0"
                        />
                      ) : (
                        <div className={`clinical-input clinical-input-readonly text-center ${hasAdditional ? 'text-primary font-semibold' : ''}`}>
                          {clinicalBottleCapacity(type)>0 ? Number(contrastEquivalent(type,received.mls).toFixed(3)) : received.bottles}
                          {hasAdditional && <Plus className="inline h-3 w-3 ml-0.5 text-primary" />}
                        </div>
                      )}
                    </td>
                  </>
                );
              })}
            </tr>

            {/* Additional Stock Received Row (afternoon/night only) */}
            {!isMorning && (
              <tr className="hover:bg-muted/20 transition-colors bg-primary/5">
                <td className="p-3 text-sm font-medium text-foreground border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-primary" />
                    <span>Additional Stock</span>
                  </div>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    (Extra received this shift)
                  </span>
                </td>
                {CONTRAST_TYPES.map((type) => {
                  const additional = getAdditionalReceivedValues(shift, type);
                  return (
                    <>
                      <td key={`${type}-additional-mls`} className="p-2 border-b border-border border-l">
                        <input
                          type="number"
                          min="0"
                          max={100000}
                          value={additional.mls || ''}
                          onChange={(e) => onAdditionalReceivedChange(type, 'mls', Number(e.target.value) || 0)}
                          className="clinical-input text-center border-primary/30"
                          placeholder="0"
                        />
                      </td>
                      <td key={`${type}-additional-bottles`} className="p-2 border-b border-border">
                        <input
                          type="number"
                          min="0"
                          max={1000}
                          readOnly={clinicalBottleCapacity(type)>0} value={(clinicalBottleCapacity(type)>0 ? Number(contrastEquivalent(type,additional.mls).toFixed(3)) : additional.bottles) || ''}
                          onChange={(e) => onAdditionalReceivedChange(type, 'bottles', Number(e.target.value) || 0)}
                          className="clinical-input text-center border-primary/30"
                          placeholder="0"
                        />
                      </td>
                    </>
                  );
                })}
              </tr>
            )}

            {/* Total Consumption Row */}
            <tr className="hover:bg-muted/20 transition-colors">
              <td className="p-3 text-sm font-medium text-foreground border-b border-border">
                Total Consumption
              </td>
              {CONTRAST_TYPES.map((type) => (
                <>
                  <td key={`${type}-consumption-mls`} className="p-2 border-b border-border border-l">
                    <input
                      type="number"
                      min="0"
                      max={100000}
                      value={consumption[type].mls || ''}
                      onChange={(e) => onConsumptionChange(type, 'mls', Number(e.target.value) || 0)}
                      className="clinical-input text-center"
                      placeholder="0"
                    />
                  </td>
                  <td key={`${type}-consumption-bottles`} className="p-2 border-b border-border">
                    <input
                      type="number"
                      min="0"
                      max={1000}
                      readOnly={clinicalBottleCapacity(type)>0} value={(clinicalBottleCapacity(type)>0 ? Number(contrastEquivalent(type,consumption[type].mls).toFixed(3)) : consumption[type].bottles) || ''}
                      onChange={(e) => onConsumptionChange(type, 'bottles', Number(e.target.value) || 0)}
                      className="clinical-input text-center"
                      placeholder="0"
                    />
                  </td>
                </>
              ))}
            </tr>

            {/* Number of Patients Row */}
            <tr className="hover:bg-muted/20 transition-colors bg-accent/10">
              <td className="p-3 text-sm font-medium text-foreground border-b border-border">
                No. of Patients
              </td>
              {CONTRAST_TYPES.map((type) => (
                <>
                  <td key={`${type}-patients`} colSpan={2} className="p-2 border-b border-border border-l">
                    <input
                      type="number"
                      min="0"
                      max={10000}
                      value={patients[type] || ''}
                      onChange={(e) => onPatientsChange(type, Number(e.target.value) || 0)}
                      className="clinical-input text-center"
                      placeholder="0"
                    />
                  </td>
                </>
              ))}
            </tr>
            <tr className="bg-accent/30 hover:bg-accent/40 transition-colors">
              <td className="p-3 text-sm font-bold text-foreground border-b border-border">
                Outstanding Stock
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  (Received - Consumption)
                </span>
              </td>
              {CONTRAST_TYPES.map((type) => {
                const outstanding = getOutstandingValues(shift, type);
                const isMlsNegative = outstanding.mls < 0;
                const isBottlesNegative = clinicalBottleCapacity(type)>0 ? isMlsNegative : outstanding.bottles < 0;

                return (
                  <>
                    <td
                      key={`${type}-outstanding-mls`}
                      className={`p-2 border-b border-border border-l text-center ${
                        isMlsNegative ? 'bg-destructive/10' : ''
                      }`}
                    >
                      <div className={`clinical-input clinical-input-readonly text-center ${
                        isMlsNegative ? 'stock-negative' : 'stock-positive'
                      }`}>
                        {renderValueCell(outstanding.mls, isMlsNegative, true)}
                      </div>
                    </td>
                    <td
                      key={`${type}-outstanding-bottles`}
                      className={`p-2 border-b border-border text-center ${
                        isBottlesNegative ? 'bg-destructive/10' : ''
                      }`}
                    >
                      <div className={`clinical-input clinical-input-readonly text-center ${
                        isBottlesNegative ? 'stock-negative' : 'stock-positive'
                      }`}>
                        {renderValueCell(clinicalBottleCapacity(type)>0 ? Number(contrastEquivalent(type,outstanding.mls).toFixed(3)) : outstanding.bottles, isMlsNegative, true)}
                      </div>
                    </td>
                  </>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CONTRAST_TYPES.map((type) => {
          const received = getReceivedValues(shift, type);
          const consumedMls = consumption[type].mls;
          const progressPercentage = received.mls > 0 ? (consumedMls / received.mls) * 100 : 0;
          const isOverLimit = progressPercentage > 100;

          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {CONTRAST_LABELS[type]}
                </span>
                <span className={`text-xs font-semibold ${isOverLimit ? 'text-destructive' : 'text-primary'}`}>
                  {Math.min(Math.round(progressPercentage), 999)}%
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    isOverLimit ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(progressPercentage, 100)}%`,
                  }}
                />
              </div>

              {/* Stats */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Used:</span>
                  <span>{consumedMls} mls</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{received.mls} mls</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};



