import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DailyData, ContrastType, CONTRAST_LABELS } from '@/types/contrast';

interface DailySummaryProps {
  data: DailyData;
}

const CONTRAST_TYPES: ContrastType[] = ['jodascan300', 'hexopack350', 'gastrolux', 'mriContrast'];

const COLORS = [
  'hsl(160, 45%, 22%)',   // Dark forest green
  'hsl(162, 55%, 38%)',   // Teal
  'hsl(200, 55%, 45%)',   // Blue
  'hsl(152, 55%, 42%)',   // Green
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
    <div className="dashboard-card p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Daily Summary</h3>
      
      {/* Donut Chart */}
      <div className="relative w-full aspect-square max-w-[180px] mx-auto mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? chartData : [{ name: 'No data', value: 1 }]}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={hasData ? 3 : 0}
              dataKey="value"
              strokeWidth={0}
            >
              {hasData ? (
                chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))
              ) : (
                <Cell fill="hsl(80, 15%, 87%)" />
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-primary">
            {totalConsumed.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">mls used</span>
          {totalReceived > 0 && (
            <span className={`text-xs font-medium mt-0.5 ${
              consumptionPercentage > 100 ? 'text-destructive' : 
              consumptionPercentage > 80 ? 'text-warning' : 'text-muted-foreground'
            }`}>
              {consumptionPercentage}% of stock
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 mb-4">
        {consumptionByType.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index] }}
              />
              <span className="text-foreground text-xs">{item.name}</span>
            </div>
            <span className="font-medium text-foreground text-xs">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      
      {/* Stock Summary */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Stock</span>
          <span className="font-semibold text-foreground">{totalReceived.toLocaleString()} mls</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Remaining</span>
          <span className={`font-semibold ${
            totalReceived - totalConsumed < 0 ? 'text-destructive' : 'text-primary'
          }`}>
            {(totalReceived - totalConsumed).toLocaleString()} mls
          </span>
        </div>
      </div>

      {/* Shift breakdown */}
      <div className="mt-4 pt-3 border-t border-border">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">By Shift</h4>
        <div className="space-y-2">
          {(['morning', 'afternoon', 'night'] as const).map((shift) => {
            const shiftTotal = CONTRAST_TYPES.reduce((sum, type) => {
              return sum + data[shift][type].consumption.mls;
            }, 0);
            const shiftPercentage = totalConsumed > 0 ? Math.round((shiftTotal / totalConsumed) * 100) : 0;
            
            return (
              <div key={shift} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">{shift}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${shiftPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-12 text-right">
                    {shiftTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
