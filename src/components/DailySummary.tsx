import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DailyData, ContrastType, CONTRAST_LABELS } from '@/types/contrast';

interface DailySummaryProps {
  data: DailyData;
}

const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];

const COLORS = [
  'hsl(162, 72%, 45%)',  // Primary teal
  'hsl(180, 60%, 40%)',  // Cyan
  'hsl(200, 65%, 45%)',  // Blue
  'hsl(145, 55%, 42%)',  // Green
];

export const DailySummary = ({ data }: DailySummaryProps) => {
  // Calculate total consumption across all shifts for each contrast type
  const consumptionByType = CONTRAST_TYPES.map((type, index) => {
    const morningConsumption = data.morning[type].consumption.mls;
    const afternoonConsumption = data.afternoon[type].consumption.mls;
    const nightConsumption = data.night[type].consumption.mls;
    const total = morningConsumption + afternoonConsumption + nightConsumption;
    
    return {
      name: CONTRAST_LABELS[type],
      value: total,
      color: COLORS[index],
    };
  });

  // Calculate total received (morning only since that's the initial stock)
  const totalReceived = CONTRAST_TYPES.reduce((sum, type) => {
    return sum + data.morning[type].received.mls;
  }, 0);

  const totalConsumed = consumptionByType.reduce((sum, item) => sum + item.value, 0);
  const consumptionPercentage = totalReceived > 0 ? Math.round((totalConsumed / totalReceived) * 100) : 0;

  // Filter out zero values for the pie chart
  const chartData = consumptionByType.filter(item => item.value > 0);
  
  // If no consumption, show placeholder
  const hasData = chartData.length > 0;

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-lg shadow-black/5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Daily Summary</h3>
      
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={hasData ? chartData : [{ name: 'No data', value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={hasData ? 3 : 0}
                dataKey="value"
                strokeWidth={0}
              >
                {hasData ? (
                  chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))
                ) : (
                  <Cell fill="hsl(175, 20%, 20%)" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-primary">
              {totalConsumed.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">mls used</span>
            {totalReceived > 0 && (
              <span className={`text-sm font-medium mt-1 ${
                consumptionPercentage > 80 ? 'text-warning' : 
                consumptionPercentage > 100 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {consumptionPercentage}% of stock
              </span>
            )}
          </div>
        </div>

        {/* Legend and stats */}
        <div className="flex-1 w-full space-y-3">
          {consumptionByType.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span className="text-sm text-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {item.value.toLocaleString()} mls
                </span>
                {totalConsumed > 0 && (
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {Math.round((item.value / totalConsumed) * 100) || 0}%
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {/* Divider */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Stock</span>
              <span className="text-sm font-semibold text-foreground">{totalReceived.toLocaleString()} mls</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-medium text-muted-foreground">Remaining</span>
              <span className={`text-sm font-semibold ${
                totalReceived - totalConsumed < 0 ? 'text-destructive' : 'text-primary'
              }`}>
                {(totalReceived - totalConsumed).toLocaleString()} mls
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Shift breakdown */}
      <div className="mt-5 pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Consumption by Shift</h4>
        <div className="grid grid-cols-3 gap-3">
          {(['morning', 'afternoon', 'night'] as const).map((shift) => {
            const shiftTotal = CONTRAST_TYPES.reduce((sum, type) => {
              return sum + data[shift][type].consumption.mls;
            }, 0);
            const shiftPercentage = totalConsumed > 0 ? Math.round((shiftTotal / totalConsumed) * 100) : 0;
            
            return (
              <div 
                key={shift} 
                className="bg-muted/50 rounded-xl p-3 text-center"
              >
                <span className="text-xs text-muted-foreground capitalize">{shift}</span>
                <div className="text-lg font-semibold text-foreground mt-1">
                  {shiftTotal.toLocaleString()}
                </div>
                <span className="text-xs text-muted-foreground">{shiftPercentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
