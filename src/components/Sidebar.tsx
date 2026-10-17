import { NavLink } from 'react-router-dom'
import {
  Boxes, ChartNoAxesCombined, CircleDollarSign, FlaskConical,
  LayoutDashboard, LogOut, PlusCircle, Search, Sun, Moon, UsersRound, Sparkles
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {Appearance} from '../lib/appearance'

const links = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/inventory', 'Inventory', Boxes],
  ['/intake', 'AI intake', Sparkles],
  ['/new', 'Add item', PlusCircle],
  ['/research', 'Research', FlaskConical],
  ['/sales', 'Sales', CircleDollarSign],
  ['/contacts', 'Contacts', UsersRound],
  ['/reports', 'Reports', ChartNoAxesCombined],
]

export default function Sidebar({appearance,onToggleAppearance}:{appearance:Appearance;onToggleAppearance:()=>void}) {
  const LightIcon=appearance==='dark'?Sun:Moon
  const actionLabel=appearance==='dark'?'Switch to light mode':'Switch to dark mode'
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark"><img src="/brand/logo-symbol.png" alt="" width="40" height="40" onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentElement!.textContent="CI"}} /></div>
        <div>
          <strong>Collector Intelligence</strong>
          <span>Identify · Research · Value</span>
        </div>
        <button type="button" className="ci-appearance-toggle ci-appearance-mobile"
          onClick={onToggleAppearance} aria-label={actionLabel} title={actionLabel}>
          <LightIcon size={19}/><span className="sr-only">{actionLabel}</span>
        </button>
      </div>

      <nav>
        {links.map(([to, label, Icon]: any) => (
          <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => isActive ? 'navItem active' : 'navItem'}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebarBottom">
        <div className="navItem muted"><Search size={18}/><span>Global search soon</span></div>
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
