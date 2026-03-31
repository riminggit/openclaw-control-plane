import { useEffect, useState, type ReactNode } from 'react'

export type ThemeName = 'dark' | 'light' | 'cyberpunk' | 'forest' | 'ocean'

export const THEMES: { name: ThemeName; preview: string }[] = [
  { name: 'dark', preview: '#0b1020' },
  { name: 'light', preview: '#f0f2f5' },
  { name: 'cyberpunk', preview: '#0a0015' },
  { name: 'forest', preview: '#0d1a0d' },
  { name: 'ocean', preview: '#0a1520' },
]

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(
    (localStorage.getItem('theme') as ThemeName) || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

import { createContext, useContext } from 'react'
const ThemeContext = createContext<{ theme: ThemeName; setTheme: (t: ThemeName) => void }>({
  theme: 'dark',
  setTheme: () => {},
})
export const useTheme = () => useContext(ThemeContext)
