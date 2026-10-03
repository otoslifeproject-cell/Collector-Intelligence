import { NavLink } from 'react-router-dom'
import {
  Boxes, ChartNoAxesCombined, CircleDollarSign, FlaskConical,
  LayoutDashboard, LogOut, PlusCircle, Search, Settings, UsersRound
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const links = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/inventory', 'Inventory', Boxes],
  ['/new', 'Add item', PlusCircle],
  ['/research', 'Research', FlaskConical],
  ['/sales', 'Sales', CircleDollarSign],
  ['/contacts', 'Contacts', UsersRound],
  ['/reports', 'Reports', ChartNoAxesCombined],
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">CI</div>
        <div>
          <strong>Collector Intelligence</strong>
          <span>Collection OS</span>
        </div>
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
        <div className="navItem muted"><Settings size={18}/><span>Settings</span></div>
        <button className="navItem buttonNav" onClick={() => supabase.auth.signOut()}>
          <LogOut size={18}/><span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
