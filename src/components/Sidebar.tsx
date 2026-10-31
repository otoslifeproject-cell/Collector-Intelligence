import {useState} from 'react'
import { NavLink } from 'react-router-dom'
import {
  Boxes, ChartNoAxesCombined, CircleDollarSign, FlaskConical,
  LayoutDashboard, LogOut, Sun, Moon, Menu, X, UsersRound, Sparkles, Archive, Upload, ListChecks
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {Appearance} from '../lib/appearance'

const links = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/intake', 'Add item', Sparkles],
  ['/inventory', 'Collection', Boxes],
  ['/catch-up', 'Catch up', ListChecks],
  ['/sales', 'Sell', CircleDollarSign],
  ['/ebay', 'eBay batch', Upload],
  ['/archive', 'Archive', Archive],
]

export default function Sidebar({appearance,onToggleAppearance}:{appearance:Appearance;onToggleAppearance:()=>void}) {
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false)
  const LightIcon=appearance==='dark'?Sun:Moon
  const actionLabel=appearance==='dark'?'Switch to light mode':'Switch to dark mode'
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark"><img src="/brand/logo-symbol.png" alt="" width="40" height="40" onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentElement!.textContent="CI"}} /></div>
        <div>
          <strong>Collector Intelligence</strong>
          <span>Your private collection</span>
        </div>
        <button type="button" className="ci-appearance-toggle ci-appearance-mobile"
          onClick={onToggleAppearance} aria-label={actionLabel} title={actionLabel}>
          <LightIcon size={19}/><span className="sr-only">{actionLabel}</span>
        </button>
        <button type="button" className="ci-mobile-menu-toggle" aria-label={mobileMenuOpen?'Close navigation menu':'Open navigation menu'}
         aria-controls="ci-primary-navigation" aria-expanded={mobileMenuOpen}
         onClick={()=>setMobileMenuOpen(v=>!v)}>
         {mobileMenuOpen?<X size={20}/>:<Menu size={20}/>}<span>Menu</span>
        </button>
      </div>

      <nav id="ci-primary-navigation" className={mobileMenuOpen?'is-open':''}>
        {links.map(([to, label, Icon]: any) => (
          <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'navItem active' : 'navItem'} onClick={()=>setMobileMenuOpen(false)}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
        {false&&<details className="ci-more-navigation"><summary className="navItem">More tools</summary>

          <NavLink className="navItem" to="/research" onClick={()=>setMobileMenuOpen(false)}><FlaskConical size={18}/> Research library</NavLink>
          <NavLink className="navItem" to="/lots" onClick={()=>setMobileMenuOpen(false)}><Boxes size={18}/> Lot optimiser</NavLink>
          <NavLink className="navItem" to="/contacts" onClick={()=>setMobileMenuOpen(false)}><UsersRound size={18}/> Contacts</NavLink>
          <NavLink className="navItem" to="/reports" onClick={()=>setMobileMenuOpen(false)}><ChartNoAxesCombined size={18}/> Reports</NavLink>
        </details>}
        <button type="button" className="navItem buttonNav ci-mobile-signout" onClick={()=>supabase.auth.signOut()}>
         <LogOut size={18}/><span>Sign out</span>
        </button>
      </nav>

      <div className="sidebarBottom">

        <button type="button" className="navItem buttonNav ci-appearance-toggle"
          aria-label={actionLabel} onClick={onToggleAppearance}>
          <LightIcon size={18}/><span>{appearance==='dark'?'Light mode':'Dark mode'}</span>
        </button>
        <button className="navItem buttonNav" onClick={() => supabase.auth.signOut()}>
          <LogOut size={18}/><span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
