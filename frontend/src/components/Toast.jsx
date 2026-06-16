import { useMapStore } from '../store/mapStore'

export default function Toast() {
  const toast = useMapStore((s) => s.toast)
  if (!toast) return null

  return (
    <div
      className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{ whiteSpace: 'nowrap' }}
    >
      <div className="px-5 py-2.5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium shadow-float animate-slide-up">
        {toast.msg}
      </div>
    </div>
  )
}
