import { ShiftType, ContrastType, CONTRAST_LABELS, ContrastValues } from '@/types/contrast';

interface ContrastTableProps {
  shift: ShiftType;
  isMorning: boolean;
  getReceivedValues: (shift: ShiftType, contrastType: ContrastType) => ContrastValues;
  getOutstandingValues: (shift: ShiftType, contrastType: ContrastType) => ContrastValues;
  consumption: Record<ContrastType, ContrastValues>;
  onReceivedChange: (contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
  onConsumptionChange: (contrastType: ContrastType, field: 'mls' | 'bottles', value: number) => void;
}

const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];

export const ContrastTable = ({
  shift,
  isMorning,
  getReceivedValues,
  getOutstandingValues,
  consumption,
  onReceivedChange,
  onConsumptionChange,
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
                  Total Bottles
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
                  (Auto from previous shift)
                </span>
              )}
            </td>
            {CONTRAST_TYPES.map((type) => {
              const received = getReceivedValues(shift, type);
              return (
                <>
                  <td key={`${type}-received-mls`} className="p-2 border-b border-border border-l">
                    {isMorning ? (
                      <input
                        type="number"
                        min="0"
                        value={received.mls || ''}
                        onChange={(e) => onReceivedChange(type, 'mls', Number(e.target.value) || 0)}
                        className="clinical-input text-center"
                        placeholder="0"
                      />
                    ) : (
                      <div className="clinical-input clinical-input-readonly text-center">
                        {received.mls}
                      </div>
                    )}
                  </td>
                  <td key={`${type}-received-bottles`} className="p-2 border-b border-border">
                    {isMorning ? (
                      <input
                        type="number"
                        min="0"
                        value={received.bottles || ''}
                        onChange={(e) => onReceivedChange(type, 'bottles', Number(e.target.value) || 0)}
                        className="clinical-input text-center"
                        placeholder="0"
                      />
                    ) : (
                      <div className="clinical-input clinical-input-readonly text-center">
                        {received.bottles}
                      </div>
                    )}
                  </td>
                </>
              );
            })}
          </tr>

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
                    value={consumption[type].bottles || ''}
                    onChange={(e) => onConsumptionChange(type, 'bottles', Number(e.target.value) || 0)}
                    className="clinical-input text-center"
                    placeholder="0"
                  />
                </td>
              </>
            ))}
          </tr>

          {/* Outstanding Stock Row */}
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
              const isBottlesNegative = outstanding.bottles < 0;
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
                      {renderValueCell(outstanding.bottles, isBottlesNegative, true)}
                    </div>
                  </td>
                </>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};
