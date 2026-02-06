import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  DailyData, 
  ShiftType, 
  ContrastType, 
  ContrastValues,
  createEmptyDailyData 
} from '@/types/contrast';
import { useToast } from '@/hooks/use-toast';

export const useContrastData = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [data, setData] = useState<DailyData>(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    return createEmptyDailyData(dateStr);
  });
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const dateKey = selectedDate.toISOString().split('T')[0];

  // Load data from database
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data: row, error } = await supabase
          .from('daily_contrast_data')
          .select('data')
          .eq('date', dateKey)
          .maybeSingle();

        if (error) {
          console.error('Error loading data:', error);
          toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
          setData(createEmptyDailyData(dateKey));
        } else if (row?.data) {
          setData(row.data as unknown as DailyData);
        } else {
          setData(createEmptyDailyData(dateKey));
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setData(createEmptyDailyData(dateKey));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [dateKey, toast]);

  // Debounced save to database
  const saveToDatabase = useCallback((newData: DailyData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { error } = await (supabase
          .from('daily_contrast_data') as any)
          .upsert(
            { date: dateKey, data: newData },
            { onConflict: 'date' }
          );

        if (error) {
          console.error('Error saving data:', error);
          toast({ title: 'Error saving data', description: error.message, variant: 'destructive' });
        }
      } catch (err) {
        console.error('Error saving data:', err);
      }
    }, 500);
  }, [dateKey, toast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Calculate outstanding stock
  const calculateOutstanding = useCallback((received: ContrastValues, consumption: ContrastValues): ContrastValues => {
    return {
      mls: received.mls - consumption.mls,
      bottles: received.bottles - consumption.bottles,
    };
  }, []);

  // Helper to update and save
  const updateAndSave = useCallback((updater: (prev: DailyData) => DailyData) => {
    setData(prev => {
      const newData = updater(prev);
      saveToDatabase(newData);
      return newData;
    });
  }, [saveToDatabase]);

  // Update received values (only for morning shift)
  const updateReceived = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    if (shift !== 'morning') return;

    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.received = { ...contrastData.received, [field]: value };
      contrastData.outstanding = calculateOutstanding(contrastData.received, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding, updateAndSave]);

  // Update consumption values
  const updateConsumption = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.consumption = { ...contrastData.consumption, [field]: value };
      
      let receivedValues = contrastData.received;
      if (shift === 'afternoon') {
        receivedValues = newData.morning[contrastType].outstanding;
      } else if (shift === 'night') {
        receivedValues = newData.afternoon[contrastType].outstanding;
      }
      
      contrastData.outstanding = calculateOutstanding(receivedValues, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding, updateAndSave]);

  // Get received values for a shift (handles carry-over logic)
  const getReceivedValues = useCallback((shift: ShiftType, contrastType: ContrastType): ContrastValues => {
    if (shift === 'morning') {
      return data.morning[contrastType].received;
    } else if (shift === 'afternoon') {
      return data.morning[contrastType].outstanding;
    } else {
      return data.afternoon[contrastType].outstanding;
    }
  }, [data]);

  // Get outstanding values for a shift
  const getOutstandingValues = useCallback((shift: ShiftType, contrastType: ContrastType): ContrastValues => {
    const received = getReceivedValues(shift, contrastType);
    const consumption = data[shift][contrastType].consumption;
    return calculateOutstanding(received, consumption);
  }, [data, getReceivedValues, calculateOutstanding]);

  // Update metadata
  const updateMetadata = useCallback((
    shift: ShiftType,
    field: 'handedOverTo' | 'calculatedBy' | 'attestation',
    value: string | boolean
  ) => {
    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      shiftData.metadata = { ...shiftData.metadata, [field]: value };
      newData[shift] = shiftData;
      return newData;
    });
  }, [updateAndSave]);

  // Reset form
  const resetForm = useCallback(() => {
    const emptyData = createEmptyDailyData(dateKey);
    setData(emptyData);
    saveToDatabase(emptyData);
  }, [dateKey, saveToDatabase]);

  return {
    selectedDate,
    setSelectedDate,
    data,
    isLoading,
    updateReceived,
    updateConsumption,
    getReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  };
};
