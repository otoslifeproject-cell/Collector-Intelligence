import { Link } from 'react-router-dom'
import { Item } from '../types'
import { money } from '../lib/format'

export default function ItemCard({item}: {item:Item}) {
  const label = item.current_attribution || item.title || item.object_type || 'Unidentified object'
  return (
    <Link to={`/item/${item.id}`} className="itemCard">
      <div className="itemCardImage placeholderGlass">
        <span>{item.item_code}</span>
      </div>
      <div className="itemCardBody">
        <div className="itemMeta"><span>{item.category || 'Uncategorised'}</span><span>{item.status.replaceAll('_',' ')}</span></div>
        <h3>{label}</h3>
        <p>{[item.maker, item.period_wording, item.region_country].filter(Boolean).join(' · ') || 'Attribution pending'}</p>
        <div className="itemPriceRow">
          <div><small>Fast cash</small><strong>{money(item.quick_sale_value, item.currency || 'GBP')}</strong></div>
          <div><small>Balanced</small><strong>{money(item.balanced_value_low, item.currency || 'GBP')}–{money(item.balanced_value_high, item.currency || 'GBP')}</strong></div>
        </div>
      </div>
    </Link>
  )
}
