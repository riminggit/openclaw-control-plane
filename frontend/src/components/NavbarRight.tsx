import { useTranslation } from 'react-i18next'
import { useState, useRef, useEffect } from 'react'
import { useTheme, THEMES, type ThemeName } from './ThemeProvider'

export function NavbarRight() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const [langOpen, setLangOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
      {/* Language Switcher */}
      <div ref={langRef} style={{ position: 'relative' }}>
        <button className="nav-icon-btn" onClick={() => setLangOpen(v => !v)} title={t('language.label')}>
          🌐
        </button>
        {langOpen && (
          <div className="dropdown-menu">
            {['zh', 'en'].map(lng => (
              <button
                key={lng}
                className={`dropdown-item${i18n.language === lng ? ' active' : ''}`}
                onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('lang', lng); setLangOpen(false) }}
              >
                {t(`language.${lng}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theme Switcher */}
      <div ref={themeRef} style={{ position: 'relative' }}>
        <button className="nav-icon-btn" onClick={() => setThemeOpen(v => !v)} title={t('theme.label')}>
          🎨
        </button>
        {themeOpen && (
          <div className="dropdown-menu" style={{ padding: '8px' }}>
            {THEMES.map(th => (
              <button
                key={th.name}
                className={`dropdown-item theme-item${theme === th.name ? ' active' : ''}`}
                onClick={() => { setTheme(th.name as ThemeName); setThemeOpen(false) }}
              >
                <span
                  className="theme-swatch"
                  style={{ background: th.preview, border: theme === th.name ? '2px solid #8bb8ff' : '2px solid rgba(255,255,255,0.2)' }}
                />
                {t(`theme.${th.name}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
