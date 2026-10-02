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

type Item = Tables<'stock_items'>;
type Movement = Tables<'stock_movements'>;
type MovementType = 'receipt' | 'issue' | 'opening';
type DraftLine = { key: string; itemId: string; quantity: string };
const newLine = (): DraftLine => ({ key: crypto.randomUUID(), itemId: '', quantity: '' });
const typeLabels: Record<MovementType, string> = {
  receipt: 'Collected from store', issue: 'Picked for daily use', opening: 'Opening physical count',
};

export default function SharedStock() {
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [type, setType] = useState<MovementType>('opening');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [recipient, setRecipient] = useState('');
  const [destination, setDestination] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [itemResult, movementResult] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active', true).order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (itemResult.error || movementResult.error) {
      setError(itemResult.error?.message || movementResult.error?.message || 'Could not load shared stock.');
    } else {
      setItems(itemResult.data || []);
      setMovements(movementResult.data || []);
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
    const chosen = selectedLines.filter((line, index) => line.item && lines[index].quantity.trim() !== '' && Number.isInteger(line.quantity) && (type === 'opening' ? line.quantity >= 0 : line.quantity > 0));
    if (!date || recipient.trim().length < 2 || chosen.length !== lines.length ||
        new Set(chosen.map(line => line.item!.id)).size !== chosen.length ||
        (type === 'issue' && !destination.trim()) || !confirmed) {
      setError('Enter a date, your name and whole quantities for distinct items. An opening count can be zero. Daily picks need a destination; confirm the record before saving.');
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.rpc('record_stock_batch', {
      p_type: type,
      p_date: date,
      p_recipient: recipient.trim(),
      p_lines: chosen.map(line => ({ item_id: line.item!.id, quantity: line.quantity })),
      p_destination: type === 'issue' ? destination.trim() : null,
      p_reference: reference.trim() || null,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setNotice(`${typeLabels[type]} saved. The shared balances have been updated.`);
    setLines([newLine()]); setReference(''); setDestination(''); setConfirmed(false);
    await refresh();
  };

  return <div className="min-h-screen bg-background">
    <header className="bg-slate-950 text-white"><div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-4">
      <div><p className="text-sky-300 text-xs font-semibold uppercase tracking-wider">Radiology operations</p><h1 className="text-xl font-bold">Shared stock register</h1></div>
      <div className="flex gap-2"><Button asChild variant="ghost" className="text-white"><Link to="/inventory"><ArrowLeft className="w-4 h-4 mr-2" />Earlier records</Link></Button><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button></div>
    </div></header>
    <main className="max-w-6xl mx-auto px-5 py-7 space-y-6">
      <div><h2 className="text-2xl font-bold">One balance for the whole team</h2><p className="text-muted-foreground mt-1">Record what was actually collected from the hospital store, then record what staff pick for daily use. Requests alone do not change stock.</p></div>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 text-red-800 p-4">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 p-4">{notice}</div>}

      <section className="dashboard-card p-5 space-y-5">
        <div><h3 className="font-bold text-lg">New stock entry</h3><p className="text-sm text-muted-foreground">Enter all items from one collection or daily pick together. Each entry keeps the recipient’s name.</p></div>
        <div className="flex flex-wrap gap-2">{(['receipt','issue','opening'] as const).map(option => <Button key={option} type="button" variant={type === option ? 'default' : 'outline'} onClick={() => { setType(option); setConfirmed(false); }}>{typeLabels[option]}</Button>)}</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label htmlFor="stock-date">Date</Label><Input id="stock-date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>
          <div><Label htmlFor="stock-recipient">{type === 'receipt' ? 'Received by' : type === 'issue' ? 'Picked by' : 'Counted by'}</Label><Input id="stock-recipient" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="Staff full name" /></div>
          <div><Label htmlFor="stock-reference">Request or receipt reference (optional)</Label><Input id="stock-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="For example, STR-202609-00110" /></div>
        </div>
        {type === 'issue' && <div className="max-w-md"><Label htmlFor="stock-destination">Room or shift receiving the pick</Label><Input id="stock-destination" value={destination} onChange={event => setDestination(event.target.value)} placeholder="For example, CT morning shift" /></div>}
        {type === 'opening' && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Use an actual physical count to start an item. Opening stock can only be recorded once for each item.</p>}
        <div className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-semibold">Items</h4><Button type="button" variant="outline" size="sm" onClick={() => setLines(current => [...current, newLine()])}><Plus className="w-4 h-4 mr-1" />Add item</Button></div>
          {lines.map((line, index) => { const item=items.find(candidate => candidate.id === line.itemId); const quantity=Number(line.quantity) || 0; return <div key={line.key} className="grid sm:grid-cols-[minmax(0,1fr)_9rem_10rem_2.5rem] gap-3 items-end rounded-lg border p-3">
            <div><Label>Item {index + 1}</Label><Select value={line.itemId} onValueChange={value => setLine(line.key, { itemId: value })}><SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger><SelectContent>{items.map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.unit})</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Quantity {item ? `(${item.unit})` : ''}</Label><Input type="number" min={type === 'opening' ? '0' : '1'} step="1" value={line.quantity} onChange={event => setLine(line.key, { quantity: event.target.value })} /></div>
            <div className="text-sm text-muted-foreground">{item ? !item.opening_recorded && type !== 'opening' ? 'Record the opening physical count first' : <>Store: <strong className="text-foreground">{item.opening_recorded ? `${item.balance} ${item.unit}` : 'Opening count needed'}</strong><br />After: <strong className="text-foreground">{item.balance + (type === 'issue' ? -quantity : quantity)} {item.unit}</strong></> : 'Select an item'}</div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(current => current.filter(candidate => candidate.key !== line.key))}><Trash2 className="w-4 h-4" /></Button>
          </div>; })}
        </div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="h-4 w-4 accent-primary" /><span>I confirm these quantities were {type === 'receipt' ? 'actually received' : type === 'issue' ? 'actually picked' : 'physically counted'}.</span></label>
        <Button onClick={() => void save()} disabled={saving || loading || items.length === 0}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save and update shared balance'}</Button>
      </section>

      <section className="dashboard-card p-5"><div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Current shared balances</h3><span className="text-sm text-muted-foreground">Refreshes while this page is open</span></div>
        {loading ? <p className="text-muted-foreground">Loading stock…</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{items.map(item => <div key={item.id} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{item.name}</p>{item.opening_recorded ? <p className="text-2xl font-bold">{item.balance} <span className="text-sm font-normal">{item.unit}</span></p> : <p className="font-semibold text-amber-700 mt-2">Opening count needed</p>}</div>)}</div>}
      </section>
      <section className="dashboard-card overflow-hidden"><div className="p-5 border-b"><h3 className="font-bold text-lg">Recent stock movements</h3><p className="text-sm text-muted-foreground">The recipient, item and quantity remain in the shared record.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['Date','Movement','Item','Quantity','Balance left','Received or picked by','Destination','Reference'].map(label => <th key={label} className="text-left px-4 py-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{movements.map(row => <tr key={row.id} className="border-t"><td className="px-4 py-3 whitespace-nowrap">{row.occurred_on}</td><td className="px-4 py-3">{typeLabels[row.movement_type as MovementType]}</td><td className="px-4 py-3">{items.find(item => item.id === row.item_id)?.name || row.item_id}</td><td className="px-4 py-3">{row.quantity} {items.find(item => item.id === row.item_id)?.unit}</td><td className="px-4 py-3 font-semibold">{row.balance_after} {items.find(item => item.id === row.item_id)?.unit}</td><td className="px-4 py-3">{row.recipient_name}</td><td className="px-4 py-3">{row.destination || '—'}</td><td className="px-4 py-3">{row.reference || '—'}</td></tr>)}</tbody></table>{!loading && movements.length === 0 && <p className="p-5 text-muted-foreground">No shared movements recorded yet.</p>}</div>
      </section>
    </main>
  </div>;
}
