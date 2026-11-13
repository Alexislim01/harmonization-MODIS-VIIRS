import { useState } from 'react';
import { ChartNoAxesCombined, ArrowUpRight } from 'lucide-react';
import type { Day } from './engine';
export default function Chart({days,expanded=false,compact=false}:{days:Day[];expanded?:boolean;compact?:boolean}){
  const [visible,setVisible]=useState({modis:true,viirs:true,harmonized:true}),[frequency,setFrequency]=useState<'monthly'|'daily'>('monthly');
  const buckets=new Map<string,Day[]>();for(const d of days){const key=frequency==='monthly'?d.date.slice(0,7):d.date;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(d);}
  const series=[...buckets].map(([key,list])=>{const sum=(f:keyof Day)=>{const values=list.map(d=>d[f]).filter((v):v is number=>typeof v==='number');return values.length?values.reduce((a,b)=>a+b,0):null;};return {key,modis:sum('modis'),viirs:sum('viirs'),harmonized:sum('harmonized_count'),lower:sum('lower'),upper:sum('upper')};});
  const width=compact?350:900,height=compact?250:expanded?300:190,pad={l:44,r:18,t:18,b:28};const max=Math.max(1,...series.map(p=>Math.max(visible.modis?p.modis||0:0,visible.viirs?p.viirs||0:0,visible.harmonized?p.upper||0:0)))*1.08;
  const x=(i:number)=>pad.l+i/Math.max(1,series.length-1)*(width-pad.l-pad.r),y=(v:number)=>height-pad.b-v/max*(height-pad.t-pad.b);
  const path=(field:'modis'|'viirs'|'harmonized')=>{let pen=false;return series.map((p,i)=>{if(p[field]===null){pen=false;return '';}const cmd=pen?'L':'M';pen=true;return `${cmd}${x(i).toFixed(2)},${y(p[field]!).toFixed(2)}`;}).join(' ');};
  const band=series.map((p,i)=>p.upper===null?'':`${i===0?'M':'L'}${x(i)},${y(p.upper)}`).join(' ')+[...series].reverse().map((p,i)=>p.lower===null?'':`L${x(series.length-1-i)},${y(p.lower)}`).join(' ')+'Z';
  const [hover,setHover]=useState<number|null>(null);const hasData=series.some(d=>d.modis!==null||d.viirs!==null);
  return <section className={`panel chart-panel ${compact?'compact-chart':''}`}><div className="panel-heading"><div><h2><ChartNoAxesCombined size={17}/> Compare fire activity over time</h2><p>MODIS and VIIRS observations compared with the adjusted record.</p></div><select aria-label="Time series aggregation" className="small-select" value={frequency} onChange={e=>setFrequency(e.target.value as 'monthly'|'daily')}><option value="monthly">Monthly</option><option value="daily">Daily</option></select></div>
    <div className="chart-legend">{(['modis','viirs','harmonized'] as const).map((s,i)=><button key={s} aria-pressed={visible[s]} onClick={()=>setVisible({...visible,[s]:!visible[s]})} className={!visible[s]?'muted':''}><i style={{background:['#829aab','#9e9d79','#edb47f'][i]}}/>{s==='harmonized'?'Adjusted record':s.toUpperCase()}</button>)}<span>Shading: residual spread</span></div>
    <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Time series of raw MODIS, raw VIIRS, and harmonized fire activity">
      {Array.from({length:5},(_,i)=>{const v=max*i/4;return <g key={i}><line x1={pad.l} x2={width-pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 5"/><text x={pad.l-10} y={y(v)+4} textAnchor="end" fill="var(--muted)" fontSize="10">{v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</text></g>;})}
      {visible.harmonized&&hasData&&<path d={band} fill="#e9b383" opacity=".09"/>}
      {(['modis','viirs','harmonized'] as const).map((s,i)=>visible[s]&&<path key={s} d={path(s)} fill="none" stroke={['#829aab','#9e9d79','#edb47f'][i]} strokeWidth={s==='harmonized'?2.5:1.3} opacity={s==='harmonized'?1:.8} strokeLinejoin="round"/>)}
      {series.filter((_,i)=>i%Math.max(1,Math.floor(series.length/(compact?3:6)))===0).map(p=><text key={p.key} x={x(series.indexOf(p))} y={height-7} textAnchor="middle" fill="var(--muted)" fontSize="10">{p.key.slice(0,7)}</text>)}
      {hover!==null&&series[hover]&&<line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height-pad.b} stroke="#bbc7c4" strokeDasharray="3 3"/>}
      <rect x={pad.l} y={pad.t} width={width-pad.l-pad.r} height={height-pad.t-pad.b} fill="transparent" onMouseMove={e=>{const rect=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(series.length-1,Math.round((e.clientX-rect.left)/rect.width*(series.length-1)))));}} onMouseLeave={()=>setHover(null)}/>
    </svg>{!hasData&&<div className="chart-empty">No observations in this area and date range.</div>}{hover!==null&&series[hover]&&<div className="chart-tooltip"><strong>{series[hover].key}</strong><span>MODIS {series[hover].modis?.toFixed(1)??'—'} · VIIRS {series[hover].viirs?.toFixed(1)??'—'} · Harmonized {series[hover].harmonized?.toFixed(1)??'—'}</span></div>}</div>
    <div className="chart-caption"><span>MODIS-equivalent unique pixels / {frequency==='monthly'?'month':'day'}</span><a href="#harmonization">How are the records adjusted? <ArrowUpRight size={13}/></a></div>
  </section>;
}
