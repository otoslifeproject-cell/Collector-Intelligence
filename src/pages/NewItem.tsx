import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function NewItem() {
  const nav = useNavigate()
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [form,setForm] = useState({
    title:'', category:'Glass', object_type:'', maker:'', current_attribution:'',
    period_wording:'', region_country:'', material:'Glass', colour:'',
    acquisition_price:'', acquisition_source:'', storage_location:'', notes:''
  })

  const change = (key:string,value:string)=>setForm(v=>({...v,[key]:value}))

  const submit = async (e:FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    const {data,error} = await supabase.from('items').insert({
      ...form,
      acquisition_price: form.acquisition_price ? Number(form.acquisition_price) : null,
      title: form.title || null,
      object_type: form.object_type || null,
      maker: form.maker || null,
      current_attribution: form.current_attribution || null,
      period_wording: form.period_wording || null,
      region_country: form.region_country || null,
      colour: form.colour || null,
      acquisition_source: form.acquisition_source || null,
      storage_location: form.storage_location || null,
      notes: form.notes || null
    }).select().single()
    setSaving(false)
    if (error) setError(error.message)
    else nav(`/item/${data.id}`)
  }

  return (
    <div>
      <div className="pageHeader"><div className="eyebrow">CATALOGUE INTAKE</div><h1>Add a physical object</h1><p>Keep this fast. Create the permanent record first; research can deepen it later.</p></div>
      <form className="formCard" onSubmit={submit}>
        <div className="formSection"><h2>Basic record</h2><div className="formGrid">
          <label>Working title<input value={form.title} onChange={e=>change('title',e.target.value)} placeholder="e.g. Green and amber art-glass vase"/></label>
          <label>Category<input value={form.category} onChange={e=>change('category',e.target.value)}/></label>
          <label>Object type<input value={form.object_type} onChange={e=>change('object_type',e.target.value)} placeholder="Vase, bowl, decanter…"/></label>
          <label>Material<input value={form.material} onChange={e=>change('material',e.target.value)}/></label>
          <label>Colour<input value={form.colour} onChange={e=>change('colour',e.target.value)}/></label>
          <label>Storage location<input value={form.storage_location} onChange={e=>change('storage_location',e.target.value)} placeholder="Shelf / box / room"/></label>
        </div></div>
        <div className="formSection"><h2>Known attribution</h2><div className="formGrid">
          <label>Maker<input value={form.maker} onChange={e=>change('maker',e.target.value)} placeholder="Leave blank if unknown"/></label>
          <label>Working attribution<input value={form.current_attribution} onChange={e=>change('current_attribution',e.target.value)} placeholder="Do not overstate uncertainty"/></label>
          <label>Period wording<input value={form.period_wording} onChange={e=>change('period_wording',e.target.value)} placeholder="e.g. later 20th century"/></label>
          <label>Region / country<input value={form.region_country} onChange={e=>change('region_country',e.target.value)}/></label>
        </div></div>
        <div className="formSection"><h2>Acquisition</h2><div className="formGrid">
          <label>Purchase price (£)<input type="number" step="0.01" value={form.acquisition_price} onChange={e=>change('acquisition_price',e.target.value)}/></label>
          <label>Source<input value={form.acquisition_source} onChange={e=>change('acquisition_source',e.target.value)} placeholder="Charity shop, auction, fair…"/></label>
        </div>
        <label>Notes<textarea value={form.notes} onChange={e=>change('notes',e.target.value)} rows={5}/></label>
        </div>
        {error && <div className="errorBox">{error}</div>}
        <div className="formActions"><button className="primaryButton" disabled={saving}>{saving?'Creating…':'Create permanent CI record'}</button></div>
      </form>
    </div>
  )
}
