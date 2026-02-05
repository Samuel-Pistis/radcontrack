import { useState, useEffect, useCallback } from 'react';
import { 
  DailyData, 
  ShiftType, 
  ContrastType, 
  ContrastValues,
  createEmptyDailyData 
} from '@/types/contrast';

const STORAGE_KEY = 'radiology-contrast-data';

export const useContrastData = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [data, setData] = useState<DailyData>(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    return createEmptyDailyData(dateStr);
  });

  const dateKey = selectedDate.toISOString().split('T')[0];

  // Load data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const allData: Record<string, DailyData> = JSON.parse(stored);
        if (allData[dateKey]) {
          setData(allData[dateKey]);
        } else {
          setData(createEmptyDailyData(dateKey));
        }
      } catch {
        setData(createEmptyDailyData(dateKey));
      }
    } else {
      setData(createEmptyDailyData(dateKey));
    }
  }, [dateKey]);

  // Save data to localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let allData: Record<string, DailyData> = {};
    if (stored) {
      try {
        allData = JSON.parse(stored);
      } catch {
        allData = {};
      }
    }
    allData[dateKey] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [data, dateKey]);

  // Calculate outstanding stock
  const calculateOutstanding = useCallback((received: ContrastValues, consumption: ContrastValues): ContrastValues => {
    return {
      mls: received.mls - consumption.mls,
      bottles: received.bottles - consumption.bottles,
    };
  }, []);

  // Update received values (only for morning shift)
  const updateReceived = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    if (shift !== 'morning') return;

    setData(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.received = { ...contrastData.received, [field]: value };
      contrastData.outstanding = calculateOutstanding(contrastData.received, contrastData.consumption);
      shiftData[contrastType] = contrastData;
      newData[shift] = shiftData;
      return newData;
    });
  }, [calculateOutstanding]);

  // Update consumption values
  const updateConsumption = useCallback((
    shift: ShiftType,
    contrastType: ContrastType,
    field: 'mls' | 'bottles',
    value: number
  ) => {
    setData(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      const contrastData = { ...shiftData[contrastType] };
      contrastData.consumption = { ...contrastData.consumption, [field]: value };
      
      // Get received values (from previous shift outstanding for afternoon/night)
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
  }, [calculateOutstanding]);

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
    setData(prev => {
      const newData = { ...prev };
      const shiftData = { ...newData[shift] };
      shiftData.metadata = { ...shiftData.metadata, [field]: value };
      newData[shift] = shiftData;
      return newData;
    });
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setData(createEmptyDailyData(dateKey));
  }, [dateKey]);

  return {
    selectedDate,
    setSelectedDate,
    data,
    updateReceived,
    updateConsumption,
    getReceivedValues,
    getOutstandingValues,
    updateMetadata,
    resetForm,
  };
};
