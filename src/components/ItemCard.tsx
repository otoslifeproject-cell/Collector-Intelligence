import { Link } from 'react-router-dom'
import { Item } from '../types'
import { money } from '../lib/format'

export default function ItemCard({item,imageUrl}: {item:Item,imageUrl?:string}) {
  const label = item.title || item.object_type || item.current_attribution || 'Unidentified object'
  return (
    <Link to={`/item/${item.id}`} className="itemCard">
      <div className="itemCardImage placeholderGlass">
        {imageUrl && <img src={imageUrl} alt={item.title||item.object_type||"Collection object"} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
        <span>{item.item_code}</span>
      </div>
      <div className="itemCardBody">
        <div className="itemMeta"><span>{item.category || 'Object'}</span><span>{(item.sale_readiness || item.status).replaceAll('_',' ')}</span></div>
        <h3>{label}</h3>
        <p>{item.maker || 'Maker not confirmed'}</p>
        <div className="itemPriceRow">
          <div><small>Fast cash</small><strong>{money(item.quick_sale_value, item.currency || 'GBP')}</strong></div>

        </div>
      </div>
    </Link>
  )
}
