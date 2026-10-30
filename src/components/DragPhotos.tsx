import {useEffect,useRef,useState} from 'react'
import {movePhoto} from '../lib/photoOrder'

// Dean, 30 Oct: drag photos with a hand, not the browser's own image drag
// (which turned the photo into a long thin picture and let it drop into the
// address bar). Pointer events: a small copy of the photo follows the hand,
// the page scrolls when the hand reaches the top or bottom edge, and the photo
// lands where it is let go. Photo 1 is the main listing photo.
export type DragPhoto={key:string|number;url:string;sub?:string}
type Props={photos:DragPhoto[];onReorder:(keys:(string|number)[])=>void;status?:string;large?:boolean}

function scroller(el:HTMLElement|null):HTMLElement|Window{
 for(let n=el?.parentElement;n;n=n.parentElement){
  const s=getComputedStyle(n)
  if(/(auto|scroll)/.test(s.overflowY)&&n.scrollHeight>n.clientHeight+4)return n
 }
 return window
}

export default function DragPhotos({photos,onReorder,status,large=false}:Props){
 const tiles=useRef<(HTMLLIElement|null)[]>([])
 const start=useRef<{x:number;y:number;n:number;dx:number;dy:number;w:number}|null>(null)
 const pointer=useRef({x:0,y:0})
 const [drag,setDrag]=useState<{n:number;x:number;y:number}|null>(null)
 const [over,setOver]=useState<number|null>(null)
 const overRef=useRef<number|null>(null)
 const keys=photos.map(p=>p.key)

 useEffect(()=>{
  if(!drag)return
  document.body.classList.add('ci-dragging')
  const target=scroller(tiles.current[0])
  let frame=0
  const tick=()=>{
   const y=pointer.current.y,edge=90,h=window.innerHeight
   const speed=y<edge?-Math.ceil((edge-y)/5):y>h-edge?Math.ceil((y-(h-edge))/5):0
   if(speed){if(target===window)window.scrollBy(0,speed);else (target as HTMLElement).scrollTop+=speed;pick(pointer.current.x,y)}
   frame=requestAnimationFrame(tick)
  }
  frame=requestAnimationFrame(tick)
  return()=>{cancelAnimationFrame(frame);document.body.classList.remove('ci-dragging')}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[drag!==null])

 const pick=(x:number,y:number)=>{
  let best:number|null=null,dist=Infinity
  tiles.current.forEach((el,i)=>{
   if(!el)return
   const r=el.getBoundingClientRect()
   const d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2))
   if(d<dist){dist=d;best=i}
  })
  overRef.current=best;setOver(best)
 }
 const down=(e:React.PointerEvent<HTMLLIElement>,n:number)=>{
  if(e.button!==0)return
  const r=e.currentTarget.getBoundingClientRect()
  start.current={x:e.clientX,y:e.clientY,n,dx:e.clientX-r.left,dy:e.clientY-r.top,w:r.width}
  pointer.current={x:e.clientX,y:e.clientY}
  e.currentTarget.setPointerCapture(e.pointerId)
 }
 const move=(e:React.PointerEvent<HTMLLIElement>)=>{
  const s=start.current;if(!s)return
  pointer.current={x:e.clientX,y:e.clientY}
  if(!drag&&Math.hypot(e.clientX-s.x,e.clientY-s.y)<6)return
  setDrag({n:s.n,x:e.clientX,y:e.clientY})
  pick(e.clientX,e.clientY)
 }
 const up=()=>{
  const s=start.current;start.current=null
  if(s&&drag&&overRef.current!==null&&overRef.current!==s.n)onReorder(movePhoto(keys,s.n,overRef.current))
  setDrag(null);setOver(null);overRef.current=null
 }
 const ghostW=Math.min(150,start.current?.w||120)
 return <div className={'ci-photo-order'+(large?' is-large':'')} onDragStart={e=>e.preventDefault()}>
  <ol>{photos.map((p,n)=><li key={p.key} ref={el=>{tiles.current[n]=el}}
    onPointerDown={e=>down(e,n)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    className={(n===0?'is-main ':'')+(drag&&over===n&&drag.n!==n?'is-over ':'')+(drag?.n===n?'is-dragging':'')}>
    <img src={p.url} alt={'Photo '+(n+1)} draggable={false}/>
    <span>{n===0?'Main':n+1}</span>
    {p.sub&&<small>{p.sub}</small>}
   </li>)}</ol>
  {drag&&photos[drag.n]&&<div className="ci-photo-ghost" aria-hidden="true" style={{width:ghostW,height:ghostW,left:drag.x-ghostW/2,top:drag.y-ghostW/2}}>
   <img src={photos[drag.n].url} alt="" draggable={false}/></div>}
  <p className="ci-result-note">Hold a photo and drag it. Photo 1 is the main photo.</p>
  {status&&<p className="ci-result-note" role="status">{status}</p>}
 </div>
}
