import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,describe,it,expect,vi} from 'vitest';
import DailyUsage from './DailyUsage';
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{email:'staff@example.com'},canManageStock:false,canManageStaff:false,signOut:vi.fn()})}));
vi.mock('@/hooks/useTheme',()=>({useTheme:()=>({theme:'dark',toggleTheme:vi.fn()})}));
vi.mock('@/components/RoomUsageSection',()=>({RoomUsageSection:({selectedRoom,shift,category,onDirtyChange}:{selectedRoom:string;shift:string;category:string;onDirtyChange:(dirty:boolean)=>void})=><section><p>{selectedRoom}/{shift}/{category}</p><button onClick={()=>onDirtyChange(true)}>Change usage</button><button onClick={()=>onDirtyChange(false)}>Save mock usage</button></section>}));
afterEach(cleanup);
describe('daily usage flow',()=>{
  it('selects room, shift and entry type without showing stock forms',()=>{
    render(<MemoryRouter><DailyUsage /></MemoryRouter>);
    expect(screen.getByText('CT/morning/films')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'MRI'}));
    fireEvent.click(screen.getByRole('button',{name:'night'}));
    fireEvent.click(screen.getByRole('button',{name:'Contrast and supplies'}));
    expect(screen.getByText('MRI/night/supplies')).toBeInTheDocument();
    expect(screen.queryByText('Movement history')).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Audit history'})).not.toBeInTheDocument();
  });
  it('locks date, room, shift and entry type while changes are unsaved',()=>{
    render(<MemoryRouter><DailyUsage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Change usage'}));
    expect(screen.getByLabelText('Date')).toBeDisabled();
    expect(screen.getByRole('button',{name:'MRI'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'night'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Contrast and supplies'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Save mock usage'}));
    expect(screen.getByRole('button',{name:'MRI'})).not.toBeDisabled();
  });
});
