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
          toast({ title: 'Error loading data', description: 'Unable to load data. Please try again or contact support.', variant: 'destructive' });
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
          toast({ title: 'Error saving data', description: 'Unable to save data. Please try again or contact support.', variant: 'destructive' });
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
      mls: Math.round((received.mls - consumption.mls) * 10) / 10,
      bottles: Math.round((received.bottles - consumption.bottles) * 10) / 10,
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

  // Validate numeric input
  const validateValue = useCallback((value: number, field: 'mls' | 'bottles'): number | null => {
    if (!Number.isFinite(value)) return null;
    const max = field === 'mls' ? 100000 : 1000;
    if (value < 0 || value > max) {
      toast({
        title: 'Invalid value',
        description: `Value must be between 0 and ${max.toLocaleString()}`,
        variant: 'destructive',
      });
      return null;
    }
    return value;
  }, [toast]);

  // Update received values (only for morning shift)
  const updateReceived = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    if (shift !== 'morning') return;
    const validated = validateValue(value, field);
    if (validated === null) return;

    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.received = { ...contrastData.received, [field]: value };
      const totalReceived = {
        mls: contrastData.received.mls + (contrastData.additionalReceived?.mls || 0),
        bottles: contrastData.received.bottles + (contrastData.additionalReceived?.bottles || 0),
      };
      contrastData.outstanding = calculateOutstanding(totalReceived, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding, updateAndSave, validateValue]);

  // Update additional received values (for afternoon/night shifts)
  const updateAdditionalReceived = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    if (shift === 'morning') return;
    const validated = validateValue(value, field);
    if (validated === null) return;

    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.additionalReceived = { ...(contrastData.additionalReceived || { mls: 0, bottles: 0 }), [field]: value };

      // Carried over from previous shift
      let carriedOver: ContrastValues;
      if (shift === 'afternoon') {
        carriedOver = newData.morning[contrastType].outstanding;
      } else {
        carriedOver = newData.afternoon[contrastType].outstanding;
      }

      const totalReceived = {
        mls: carriedOver.mls + value + (field === 'mls' ? 0 : (contrastData.additionalReceived?.mls || 0)),
        bottles: carriedOver.bottles + value + (field === 'bottles' ? 0 : (contrastData.additionalReceived?.bottles || 0)),
      };
      // Simpler: just recompute properly
      const additionalFinal = { ...contrastData.additionalReceived, [field]: value };
      const totalReceivedFinal = {
        mls: carriedOver.mls + additionalFinal.mls,
        bottles: carriedOver.bottles + additionalFinal.bottles,
      };
      contrastData.outstanding = calculateOutstanding(totalReceivedFinal, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding, updateAndSave, validateValue]);

  // Update consumption values
  const updateConsumption = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    const validated = validateValue(value, field);
    if (validated === null) return;
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

      // Add additional received for non-morning shifts
      const additional = contrastData.additionalReceived || { mls: 0, bottles: 0 };
      const totalReceived = shift === 'morning' ? receivedValues : {
        mls: receivedValues.mls + additional.mls,
        bottles: receivedValues.bottles + additional.bottles,
      };
      
      contrastData.outstanding = calculateOutstanding(totalReceived, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding, updateAndSave, validateValue]);

  // Get carried-over values for a shift (from previous shift outstanding)
  const getCarriedOverValues = useCallback((shift: ShiftType, contrastType: ContrastType): ContrastValues => {
    if (shift === 'morning') {
      return data.morning[contrastType].received;
    } else if (shift === 'afternoon') {
      return data.morning[contrastType].outstanding;
    } else {
      return data.afternoon[contrastType].outstanding;
    }
  }, [data]);

  // Get total received values for a shift (carried over + additional)
  const getReceivedValues = useCallback((shift: ShiftType, contrastType: ContrastType): ContrastValues => {
    const carriedOver = getCarriedOverValues(shift, contrastType);
    if (shift === 'morning') return carriedOver;
    const additional = data[shift][contrastType].additionalReceived || { mls: 0, bottles: 0 };
    return {
      mls: carriedOver.mls + additional.mls,
      bottles: carriedOver.bottles + additional.bottles,
    };
  }, [data, getCarriedOverValues]);

  // Get additional received values for a shift
  const getAdditionalReceivedValues = useCallback((shift: ShiftType, contrastType: ContrastType): ContrastValues => {
    return data[shift][contrastType].additionalReceived || { mls: 0, bottles: 0 };
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

  // Update patient count
  const updatePatients = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    value: number
  ) => {
    if (!Number.isFinite(value) || value < 0 || value > 10000) return;
    updateAndSave(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.patients = value;
      shiftData[contrastType] = contrastData;
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
    updateAdditionalReceived,
    updateConsumption,
    updatePatients,
    getReceivedValues,
    getAdditionalReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  };
};
