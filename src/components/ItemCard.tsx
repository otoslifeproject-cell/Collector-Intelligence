import { Link } from 'react-router-dom'
import { Item } from '../types'
import {catalogueSaleLabel,provisionalMoney} from '../lib/catalogueSaleState'

export default function ItemCard({item,imageUrl,photoFallbackText='No photograph linked'}: {item:Item,imageUrl?:string,photoFallbackText?:string}) {
  const label = item.title || item.object_type || item.current_attribution || 'Unidentified object'
  return (
    <Link to={`/item/${item.id}`} className="itemCard ci-record-card">
      <div className="itemCardImage placeholderGlass">
        {imageUrl ? <img src={imageUrl} alt={item.title||item.object_type||"Collection object"} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/> : <span className="ci-missing-photo">{photoFallbackText}</span>}
        <span>{item.item_code}</span>
      </div>
      <div className="itemCardBody">
        <div className="itemMeta"><span>{item.category || 'Object'}</span><span>{catalogueSaleLabel(item)}</span></div>
        <h3>{label}</h3>
        <p>{item.maker?`Recorded attribution: ${item.maker} · verification required`:'Maker not confirmed'}</p>
        <div className="itemPriceRow">
          <div><small>Fast cash · provisional</small><strong>{provisionalMoney(item.quick_sale_value,item.currency)}</strong></div>

        </div>
      </div>
    </Link>
  )
}
