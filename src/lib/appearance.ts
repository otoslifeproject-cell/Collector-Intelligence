export type Appearance='dark'|'light'
const KEY='ci-appearance-v1'
export function appearanceFromPreference(saved:string|null,systemPrefersLight:boolean):Appearance{
 if(saved==='dark'||saved==='light')return saved
 return systemPrefersLight?'light':'dark'
}
export function storedAppearance():Appearance{
 try{
  return appearanceFromPreference(window.localStorage.getItem(KEY),
   !!window.matchMedia?.('(prefers-color-scheme: light)').matches)
 }catch{return 'dark'}
}
export function applyAppearance(value:Appearance){
 document.documentElement.dataset.theme=value
 document.documentElement.style.colorScheme=value
 try{window.localStorage.setItem(KEY,value)}catch{ /* private browsing or blocked storage */ }
}
