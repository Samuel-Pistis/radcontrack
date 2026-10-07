import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';

export function StockSummary() {
 const [items,setItems]=useState<Tables<'stock_items'>[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;void Promise.resolve(supabase.from('stock_items').select('*').eq('active',true).order('name')).then(result=>{
  if(!active)return;if(result.error)setError(result.error.message);else setItems(result.data||[]);
 }).catch(()=>{if(active)setError('Unable to load department balances.');});return()=>{active=false;};},[]);
 return <details className="border-t pt-4"><summary className="cursor-pointer font-semibold">Department stock now, including gloves</summary><p className="text-sm text-muted-foreground my-3">Current departmental balance, not usage for the selected date. Gloves are counted in packs. <Link className="underline" to="/stock/balances">See room balances</Link>.</p>{error&&<p role="alert">{error}</p>}<dl className="divide-y">{items.map(item=><div key={item.id} className="flex justify-between gap-4 py-2"><dt>{item.name}</dt><dd>{item.opening_recorded?`${item.balance} ${item.unit}`:`${item.balance} ${item.unit} recorded; opening count unconfirmed`}</dd></div>)}</dl></details>;
}
