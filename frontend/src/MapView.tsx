import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Layers, Minus, Plus, SquareDashedMousePointer, Pentagon, Check, X } from 'lucide-react';
import type { Observation, Shape } from './engine';
import { createMapMotion } from './mapMotion';

type Props={bbox:number[];hotspots:Observation[];grid:number;selectedDate:string|null;onShape:(shape:Shape,bbox:number[])=>void;name:string};
export default function MapView({bbox,hotspots,grid,selectedDate,onShape,name}:Props){
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),points=useRef<L.LayerGroup|null>(null),area=useRef<L.LayerGroup|null>(null),tiles=useRef<L.TileLayer|null>(null);
  const [style,setStyle]=useState<'terrain'|'satellite'>('terrain'),[drawing,setDrawing]=useState<'rectangle'|'polygon'|null>(null),[vertices,setVertices]=useState<L.LatLng[]>([]),[showGrid,setShowGrid]=useState(false);
  const mode=useRef(drawing),verts=useRef(vertices);mode.current=drawing;verts.current=vertices;
  const currentBounds=useRef(bbox);currentBounds.current=bbox;
  const motion=useRef<ReturnType<typeof createMapMotion>|null>(null);
  const fitted=useRef(false);
  useEffect(()=>{
    if(!container.current)return;
    const m=L.map(container.current,{zoomControl:false,attributionControl:true,preferCanvas:true,minZoom:2,maxZoom:12,zoomSnap:0,zoomDelta:.5,scrollWheelZoom:false,doubleClickZoom:false,inertia:true,inertiaDeceleration:1800,easeLinearity:.16}).setView([1.5,113.5],5);map.current=m;
    motion.current=createMapMotion(m,()=>mode.current!==null);
    points.current=L.layerGroup().addTo(m);area.current=L.layerGroup().addTo(m);
    const abort=new AbortController();
    let resizeTimer:ReturnType<typeof setTimeout>|undefined;
    let initialSize=true;
    const resize=new ResizeObserver(()=>{
      m.invalidateSize({pan:false});
      if(initialSize){initialSize=false;return;}
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(()=>{const b=currentBounds.current;motion.current?.fitBounds([[b[1],b[0]],[b[3],b[2]]]);},150);
    });
    resize.observe(container.current);
    fetch('/data/world.geojson',{signal:abort.signal}).then(r=>r.json()).then(data=>{if(!map.current)return;L.geoJSON(data,{style:{color:'#567066',weight:.7,fillColor:'#22372f',fillOpacity:1},interactive:false}).addTo(m).bringToBack();}).catch(()=>{});
    m.attributionControl.setPrefix(false);m.attributionControl.addAttribution('© <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · NASA FIRMS');
    m.on('click',(e:L.LeafletMouseEvent)=>{if(mode.current)setVertices(v=>[...v,e.latlng]);});
    return()=>{abort.abort();resize.disconnect();clearTimeout(resizeTimer);motion.current?.destroy();motion.current=null;fitted.current=false;m.remove();map.current=null;};
  },[]);
  useEffect(()=>{if(!motion.current)return;motion.current.fitBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]],fitted.current);fitted.current=true;},[bbox.join(',')]);
  useEffect(()=>{
    const m=map.current;if(!m)return;if(tiles.current){m.removeLayer(tiles.current);tiles.current=null;}
    if(style==='satellite')tiles.current=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles © Esri',maxZoom:12}).addTo(m);
  },[style]);
  useEffect(()=>{const group=points.current;if(!group)return;group.clearLayers();const rows=selectedDate?hotspots.filter(r=>r.acq_date===selectedDate):hotspots;
    // Spatially group for rendering only. Exports retain all accepted observations.
    const bins=new Map<string,{lat:number;lng:number;n:number;frp:number;sensors:Set<string>;date:string}>();
    for(const r of rows){const cell=showGrid?grid:.035,key=`${Math.floor(r.latitude/cell)},${Math.floor(r.longitude/cell)}`;
      if(!bins.has(key))bins.set(key,{lat:r.latitude,lng:r.longitude,n:0,frp:0,sensors:new Set(),date:r.acq_date});const b=bins.get(key)!;b.n++;b.frp+=r.frp;b.sensors.add(r.instrument);}
    for(const b of bins.values()){
      const options={radius:Math.min(7,2+Math.log(b.n+1)),color:'#ffd4a0',weight:.3,fillColor:b.n>15?'#ffcf87':b.n>4?'#f49b62':'#e76f51',fillOpacity:.88};
      const marker=showGrid?L.rectangle([[Math.floor(b.lat/grid)*grid,Math.floor(b.lng/grid)*grid],[Math.floor(b.lat/grid)*grid+grid,Math.floor(b.lng/grid)*grid+grid]],{...options,color:'#ed9a61',weight:.7,fillOpacity:.25+Math.min(.5,b.n/80)}):L.circleMarker([b.lat,b.lng],options);
      marker.bindTooltip(`${b.n.toLocaleString()} detections · ${b.frp.toFixed(1)} MW<br>${[...b.sensors].join(' + ')}${selectedDate?` · ${selectedDate}`:''}`);marker.addTo(group);
    }
  },[hotspots,selectedDate,grid,showGrid,style]);
  useEffect(()=>{const m=map.current,group=area.current;if(!m||!group)return;group.clearLayers();if(drawing){if(vertices.length)L.polyline(vertices,{color:'#edb77c',dashArray:'5 5'}).addTo(group);return;}
    L.rectangle([[bbox[1],bbox[0]],[bbox[3],bbox[2]]],{color:'#b3c3a3',weight:1,dashArray:'5 6',fillOpacity:0,interactive:false}).addTo(group);
  },[drawing,vertices,bbox.join(',')]);
  useEffect(()=>{if(drawing==='rectangle'&&vertices.length===2)finish();},[vertices]);
  function finish(){if(vertices.length<(drawing==='rectangle'?2:3))return;let ring:number[][];
    if(drawing==='rectangle'){const [a,b]=vertices;ring=[[Math.min(a.lng,b.lng),Math.min(a.lat,b.lat)],[Math.max(a.lng,b.lng),Math.min(a.lat,b.lat)],[Math.max(a.lng,b.lng),Math.max(a.lat,b.lat)],[Math.min(a.lng,b.lng),Math.max(a.lat,b.lat)]];}else ring=vertices.map(v=>[v.lng,v.lat]);
    ring.push(ring[0]);const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
    if(bounds[0]===bounds[2]||bounds[1]===bounds[3]){setDrawing(null);setVertices([]);return;}
    onShape({type:'Polygon',coordinates:[ring]},bounds);setDrawing(null);setVertices([]);
  }
  function begin(mode:'rectangle'|'polygon'){setVertices([]);setDrawing(drawing===mode?null:mode);}
  return <div className={`map-wrap ${drawing?'is-drawing':''}`}>
    <div ref={container} className="map-canvas" aria-label={`Interactive map of ${name}; ${hotspots.length} fire observations`}/>
    <div className="map-tools" role="group" aria-label="Map navigation"><button title="Zoom in" aria-label="Zoom in" onClick={()=>motion.current?.zoomBy(.5)}><Plus size={19}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>motion.current?.zoomBy(-.5)}><Minus size={19}/></button><i/><button title="Return to selected area" aria-label="Fit selected area" onClick={()=>motion.current?.fitBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]])}><Crosshair size={19}/></button></div>
    <div className="map-draw-tools" role="group" aria-label="Draw a custom area"><span>Draw an area</span><button title="Select two opposite corners on the map" aria-label="Draw rectangle" aria-pressed={drawing==='rectangle'} onClick={()=>begin('rectangle')}><SquareDashedMousePointer size={17}/><span>Rectangle</span></button><button title="Select at least three points, then finish" aria-label="Draw polygon" aria-pressed={drawing==='polygon'} onClick={()=>begin('polygon')}><Pentagon size={17}/><span>Polygon</span></button></div>
    {drawing&&<div className="draw-hint"><span>{drawing==='rectangle'?'Click two opposite corners':'Click to add polygon vertices'}</span>{drawing==='polygon'&&<button onClick={finish} disabled={vertices.length<3}><Check size={15}/> Finish</button>}<button aria-label="Cancel drawing" onClick={()=>{setDrawing(null);setVertices([]);}}><X size={15}/></button></div>}
    <div className="map-bottom"><div className="map-key"><span className="fire-dot"/>Satellite fire detections <span className="map-key-divider"/> {showGrid?`${grid}° cells`:'Nearby points grouped'}</div><div className="map-style"><button className={showGrid?'active':''} aria-pressed={showGrid} onClick={()=>setShowGrid(!showGrid)}><Layers size={15}/> Grid</button><button className={style==='terrain'?'active':''} aria-pressed={style==='terrain'} onClick={()=>setStyle('terrain')}>Map</button><button className={style==='satellite'?'active':''} aria-pressed={style==='satellite'} onClick={()=>setStyle('satellite')}>Satellite</button></div></div>
  </div>;
}
