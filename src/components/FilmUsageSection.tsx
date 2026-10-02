import type { ShiftType } from '@/types/contrast';
import { RoomUsageSection } from '@/components/RoomUsageSection';
export function FilmUsageSection({ shift, date }: { shift: ShiftType; date: Date }) {
  return <RoomUsageSection shift={shift} date={date} category="films" />;
}
