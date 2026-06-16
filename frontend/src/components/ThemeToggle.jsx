import { Sun, Moon } from 'lucide-react'
import { useMapStore } from '../store/mapStore'

export default function ThemeToggle({ className = '', white = false }) {
  const theme    = useMapStore((s) => s.theme)
  const setTheme = useMapStore((s) => s.setTheme)

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        white
          ? 'text-white/60 hover:text-white hover:bg-white/10'
          : 'text-txt-secondary dark:text-txt-secondary-dark hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
