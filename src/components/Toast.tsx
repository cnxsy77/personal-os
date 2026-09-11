import './Toast.css'

type ToastProps = {
  message: string
}

export function Toast({ message }: ToastProps) {
  return (
    <output aria-live="polite" className="toast">
      {message}
    </output>
  )
}
