import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STOCK_ROOMS, STOCK_SHIFTS, roomUnit, toRoomUnits, bottleCapacity, stockAmount } from '@/lib/roomStock';

type Item = Tables<'stock_items'>;
type Movement = Tables<'stock_movements'>;
type MovementType = 'receipt' | 'issue' | 'opening' | 'room_count';
type DraftLine = { key: string; itemId: string; quantity: string };
const newLine = (): DraftLine => ({ key: crypto.randomUUID(), itemId: '', quantity: '' });
const typeLabels: Record<MovementType, string> = {
  receipt: 'Collected from store', issue: 'Picked for daily use', opening: 'Count store stock now', room_count: 'Count room stock now',
};

export default function SharedStock() {
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [roomStock, setRoomStock] = useState<Tables<'room_stock'>[]>([]);
  const [roomMovements, setRoomMovements] = useState<Tables<'room_stock_movements'>[]>([]);
  const [type, setType] = useState<MovementType>('receipt');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [recipient, setRecipient] = useState('');
  const [destination, setDestination] = useState('');
  const [shift, setShift] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestId,setRequestId] = useState(()=>crypto.randomUUID());

  const refresh = useCallback(async () => {
    const [itemResult, movementResult, roomResult, roomMovementResult] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active', true).order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('room_stock').select('*'),
      supabase.from('room_stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (itemResult.error || movementResult.error || roomResult.error || roomMovementResult.error) {
      setError(itemResult.error?.message || movementResult.error?.message || roomResult.error?.message || roomMovementResult.error?.message || 'Could not load shared stock.');
    } else {
      setItems(itemResult.data || []);
      setMovements(movementResult.data || []);
      setRoomStock(roomResult.data || []);
      setRoomMovements(roomMovementResult.data || []);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const selectedLines = useMemo(() => lines.map(line => ({
    item: items.find(item => item.id === line.itemId), quantity: Number(line.quantity),
  })), [items, lines]);

  const setLine = (key: string, patch: Partial<DraftLine>) => {
    setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line));
    setNotice('');
  };

  const save = async () => {
    setError(''); setNotice('');
    const isCount = type === 'opening' || type === 'room_count';
    const chosen = selectedLines.filter((line, index) => line.item && lines[index].quantity.trim() !== '' && (Number.isInteger(line.quantity) || (type === 'room_count' && bottleCapacity(line.item.id) > 0 && Number.isFinite(line.quantity) && Math.abs(line.quantity * 100 - Math.round(line.quantity * 100)) < 0.00001)) && (isCount ? line.quantity >= 0 : line.quantity > 0));
    if (!date || recipient.trim().length < 2 || chosen.length !== lines.length ||
        new Set(chosen.map(line => line.item!.id)).size !== chosen.length ||
        ((type === 'issue' || type === 'room_count') && !destination) || (type === 'issue' && !shift) || !confirmed) {
      setError('Enter a date, your name and quantities for distinct items. CT and MRI room counts use ml; other quantities are whole numbers. Counts can be zero. Daily picks need a room and shift; confirm before saving.');
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.rpc('move_room_stock_volume', {
      p_type: type,
      p_date: date,
      p_staff: recipient.trim(),
      p_lines: chosen.map(line => ({ item_id: line.item!.id, quantity: line.quantity })),
      p_room: type === 'issue' || type === 'room_count' ? destination : null,
      p_shift: type === 'issue' ? shift : null,
      p_reference: reference.trim() || null,
      p_request: requestId,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setNotice(`${typeLabels[type]} saved.${type === 'issue' ? ' Stock moved to the room; it has not been consumed.' : ''} Uncounted balances remain awaiting a physical count.`);
    setLines([newLine()]); setReference(''); setDestination(''); setConfirmed(false);
    setRequestId(crypto.randomUUID());
    await refresh();
  };

  return <div className="min-h-screen bg-background">
    <header className="bg-slate-950 text-white"><div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-4">
      <div><p className="text-sky-300 text-xs font-semibold uppercase tracking-wider">Radiology operations</p><h1 className="text-xl font-bold">Shared stock register</h1></div>
      <div className="flex gap-2"><Button asChild variant="ghost" className="text-white"><Link to="/inventory"><ArrowLeft className="w-4 h-4 mr-2" />Earlier records</Link></Button><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button></div>
    </div></header>
    <main className="max-w-6xl mx-auto px-5 py-7 space-y-6">
      <div><h2 className="text-2xl font-bold">Store stock, room stock and actual use</h2><p className="text-muted-foreground mt-1">Collections add stock to the store. Picks move it into a room. Save daily usage to subtract what was actually used. Leftovers stay in the room for the next shift.</p><Button asChild variant="link" className="px-0"><Link to="/">Record daily usage</Link></Button></div>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 text-red-800 p-4">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 p-4">{notice}</div>}

      <section className="dashboard-card p-5 space-y-5">
        <div><h3 className="font-bold text-lg">New stock entry</h3><p className="text-sm text-muted-foreground">Enter all items from one collection or daily pick together. Each entry keeps the recipient’s name.</p></div>
        <div className="flex flex-wrap gap-2">{(['receipt','issue','opening','room_count'] as const).map(option => <Button key={option} type="button" variant={type === option ? 'default' : 'outline'} onClick={() => { setType(option); setConfirmed(false); if (option === 'opening' || option === 'room_count') setDate(format(new Date(), 'yyyy-MM-dd')); }}>{typeLabels[option]}</Button>)}</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor="stock-date">Date</Label><Input id="stock-date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>
          <div><Label htmlFor="stock-recipient">{type === 'receipt' ? 'Received by' : type === 'issue' ? 'Picked by' : 'Counted by'}</Label><Input id="stock-recipient" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="Staff full name" /></div>
          <div><Label htmlFor="stock-reference">Request or receipt reference (optional)</Label><Input id="stock-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="For example, STR-202609-00110" /></div>
        </div>
        {(type === 'issue' || type === 'room_count') && <div className="grid sm:grid-cols-2 gap-4 max-w-xl"><div><Label>Room</Label><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue placeholder="Choose room" /></SelectTrigger><SelectContent>{STOCK_ROOMS.map(room => <SelectItem key={room} value={room}>{room}</SelectItem>)}</SelectContent></Select></div>{type === 'issue' && <div><Label>Shift receiving this pick</Label><Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue placeholder="Choose shift" /></SelectTrigger><SelectContent>{STOCK_SHIFTS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>}</div>}
        {(type === 'opening' || type === 'room_count') && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Count what is physically here now, including any recent collections. This replaces the recorded balance at this location; it does not add more stock. Room film counts use individual films, not packs.</p>}
        {type === 'receipt' && <p className="text-sm text-muted-foreground">You can save a collection before counting existing stock. The full balance will remain unconfirmed until counted. Do not add a collection again if a later physical count already included it.</p>}
        <div className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-semibold">Items</h4><Button type="button" variant="outline" size="sm" onClick={() => setLines(current => [...current, newLine()])}><Plus className="w-4 h-4 mr-1" />Add item</Button></div>
          {lines.map((line, index) => { const item=items.find(candidate => candidate.id === line.itemId); const quantity=Number(line.quantity) || 0; return <div key={line.key} className="grid sm:grid-cols-[minmax(0,1fr)_9rem_10rem_2.5rem] gap-3 items-end rounded-lg border p-3">
            <div><Label>Item {index + 1}</Label><Select value={line.itemId} onValueChange={value => setLine(line.key, { itemId: value })}><SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger><SelectContent>{items.map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.unit})</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Quantity {item ? `(${type === 'room_count' ? roomUnit(item.id,item.unit) : item.unit})` : ''}</Label><Input type="number" min={type === 'opening' || type === 'room_count' ? '0' : '1'} step={type === 'room_count' && item && bottleCapacity(item.id) ? '0.01' : '1'} value={line.quantity} onChange={event => setLine(line.key, { quantity: event.target.value })} /></div>
            <div className="text-sm text-muted-foreground">{item ? type === 'room_count' ? `Room count: ${quantity} ${roomUnit(item.id,item.unit)}` : <><span>Store: {item.opening_recorded ? `${item.balance} ${item.unit}` : 'balance awaiting stock count'}</span><br />{type === 'opening' ? `Counted now: ${quantity} ${item.unit}` : type === 'issue' ? `To room: ${toRoomUnits(item.id,quantity)} ${roomUnit(item.id,item.unit)}` : `Adding: ${quantity} ${item.unit}`}</> : 'Select an item'}</div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(current => current.filter(candidate => candidate.key !== line.key))}><Trash2 className="w-4 h-4" /></Button>
          </div>; })}
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="h-4 w-4 accent-primary" /><span>I confirm these quantities were {type === 'receipt' ? 'actually received' : type === 'issue' ? 'actually picked' : 'physically counted'}.</span></label>
        <Button onClick={() => void save()} disabled={saving || loading || items.length === 0}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save stock entry'}</Button>
      </section>

      <section className="dashboard-card p-5"><div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Current shared balances</h3><span className="text-sm text-muted-foreground">Refreshes while this page is open</span></div>
        {loading ? <p className="text-muted-foreground">Loading stock…</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map(item => <div key={item.id} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{item.name}</p>{item.opening_recorded ? <p className="text-2xl font-bold">{item.balance} <span className="text-sm font-normal">{item.unit}</span></p> : <p className="font-semibold text-amber-700 mt-2">Balance awaiting stock count</p>}</div>)}</div>}
      </section>
      <section className="dashboard-card p-5"><h3 className="font-bold text-lg mb-2">Stock in rooms and total remaining</h3><p className="text-sm text-muted-foreground mb-4">Films are shown individually (100 per pack). A pick changes location, not the total. Uncounted locations prevent a confirmed department total.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Item','Store',...STOCK_ROOMS,'Total remaining'].map(label=><th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{items.map(item=>{const rooms=STOCK_ROOMS.map(room=>roomStock.find(row=>row.room===room&&row.item_id===item.id)); const total=toRoomUnits(item.id,item.balance)+rooms.reduce((sum,row)=>sum+(row?.balance||0),0); const known=item.opening_recorded&&rooms.every(row=>row?.counted_on); return <tr key={item.id} className="border-t"><td className="p-3">{item.name} ({roomUnit(item.id,item.unit)})</td><td className="p-3">{item.opening_recorded ? stockAmount(item.id,toRoomUnits(item.id,item.balance)) : 'Awaiting count'}</td>{rooms.map((row,index)=><td key={STOCK_ROOMS[index]} className="p-3">{row?.counted_on ? stockAmount(item.id,row.balance) : 'Awaiting count'}</td>)}<td className="p-3 font-semibold">{known ? stockAmount(item.id,total) : 'Unconfirmed'}</td></tr>})}</tbody></table></div></section>
      <section className="dashboard-card p-5"><h3 className="font-bold text-lg mb-3">Room picks, usage and counts</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Date','Room / shift','Item','Movement','Change','Room balance','Recorded by'].map(label=><th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{roomMovements.map(row=><tr key={row.id} className="border-t"><td className="p-3">{row.occurred_on}</td><td className="p-3">{row.room} {row.shift}</td><td className="p-3">{items.find(item=>item.id===row.item_id)?.name}</td><td className="p-3">{row.movement_type}</td><td className="p-3">{row.change>0?'+':''}{stockAmount(row.item_id,row.change)}</td><td className="p-3">{row.balance_known?stockAmount(row.item_id,row.balance_after):'Awaiting count'}</td><td className="p-3">{row.staff_name}</td></tr>)}</tbody></table></div></section>
      <section className="dashboard-card overflow-hidden"><div className="p-5 border-b"><h3 className="font-bold text-lg">Recent store movements</h3><p className="text-sm text-muted-foreground">The recipient, item and quantity remain in the shared record.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['Date','Movement','Item','Quantity','Balance left','Received or picked by','Destination','Reference'].map(label => <th key={label} className="text-left px-4 py-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{movements.map(row => <tr key={row.id} className="border-t"><td className="px-4 py-3 whitespace-nowrap">{row.occurred_on}</td><td className="px-4 py-3">{typeLabels[row.movement_type as MovementType]}</td><td className="px-4 py-3">{items.find(item => item.id === row.item_id)?.name || row.item_id}</td><td className="px-4 py-3">{row.quantity} {items.find(item => item.id === row.item_id)?.unit}</td><td className="px-4 py-3 font-semibold">{row.balance_known ? `${row.balance_after} ${items.find(item => item.id === row.item_id)?.unit}` : 'Awaiting count'}</td><td className="px-4 py-3">{row.recipient_name}</td><td className="px-4 py-3">{[row.destination,row.shift].filter(Boolean).join(' · ') || '—'}</td><td className="px-4 py-3">{row.reference || '—'}</td></tr>)}</tbody></table>{!loading && movements.length === 0 && <p className="p-5 text-muted-foreground">No shared movements recorded yet.</p>}</div>
      </section>
    </main>
  </div>;
}



