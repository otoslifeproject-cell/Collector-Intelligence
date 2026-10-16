import { Search, SlidersHorizontal, LayoutGrid, List, Grid2X2 } from 'lucide-react'

export type ObjectView = 'tiles' | 'list' | 'compact'
export type ObjectFilter = {value:string;label:string}

type Props = {
 query:string
 onQueryChange:(value:string)=>void
 view:ObjectView
 onViewChange:(value:ObjectView)=>void
 searchLabel?:string
 placeholder?:string
 filter?:string
 onFilterChange?:(value:string)=>void
 filters?:ObjectFilter[]
 filterLabel?:string
}

export default function ObjectCollectionToolbar({
 query,onQueryChange,view,onViewChange,
 searchLabel='Search objects',placeholder='Find an object…',
 filter,onFilterChange,filters,filterLabel='Filter objects'
}:Props){
 const views:[ObjectView,string,typeof LayoutGrid][]=[
  ['tiles','Tiles',LayoutGrid],['list','List',List],['compact','Icons',Grid2X2]
 ]
 return <div className="ci-inventory-controls" role="search">
  <div className="ci-search-control searchBox">
   <Search size={18}/>
   <input aria-label={searchLabel} placeholder={placeholder} value={query}
    onChange={e=>onQueryChange(e.target.value)}/>
  </div>
  <div className="ci-toolbar-actions">
   {filters&&filter!==undefined&&onFilterChange&&<div className="ci-status-control selectWrap">
    <SlidersHorizontal size={18}/>
    <select aria-label={filterLabel} value={filter} onChange={e=>onFilterChange(e.target.value)}>
     {filters.map(f=><option value={f.value} key={f.value}>{f.label}</option>)}
    </select>
   </div>}
   <div className="ci-view-switch" role="group" aria-label="Object layout">
    {views.map(([value,label,Icon])=><button type="button" key={value}
      className={view===value?'active':''} aria-label={label+' view'}
      aria-pressed={view===value} onClick={()=>onViewChange(value)} title={label}>
      <Icon size={18}/><span>{label}</span>
    </button>)}
   </div>
  </div>
 </div>
}
