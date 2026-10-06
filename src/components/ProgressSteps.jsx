const steps = { checkout: ['Revisión', 'Pago', 'Confirmar'], order: ['Pendiente', 'Pagado', 'Enviado', 'Entregado'] }

function ProgressSteps({ step, variant = 'checkout' }) {
  return (
    <ol aria-label={variant === 'checkout' ? 'Pasos de compra' : 'Estado del pedido'} className={`flex min-w-0 items-start ${variant === 'checkout' ? 'gap-2.5 sm:pr-[3.05rem]' : 'w-full justify-between gap-2'}`}>
      {steps[variant].map((label, index) => (
        <li key={label} className={`flex min-w-0 items-center ${index < steps[variant].length - 1 ? variant === 'checkout' ? 'flex-1 sm:flex-none' : 'flex-1' : ''} ${variant === 'checkout' ? 'gap-2.5' : 'gap-2'}`}>
          <div aria-current={index === step - 1 ? 'step' : undefined} className={`flex shrink-0 items-center ${variant === 'checkout' ? 'gap-2.5' : 'flex-col gap-1.5'}`}>
            <span className={`flex shrink-0 items-center justify-center rounded-full border-[2.4px] border-bordo font-extrabold ${variant === 'checkout' ? 'size-10 text-base sm:size-[3.05rem] sm:text-[1.0625rem]' : 'size-[2.175rem] text-[0.875rem]'} ${index < step - (variant === 'checkout' ? 1 : 0) ? 'bg-bordo text-crema' : index === step - 1 && variant === 'checkout' ? 'bg-rosa shadow-[0.1875rem_0.1875rem_0_var(--color-bordo)]' : 'bg-crema'}`}>{variant === 'checkout' ? index < step - 1 ? '✓' : index + 1 : index < step ? '✓' : ''}</span>
            <span className={`${variant === 'checkout' ? 'text-[0.75rem] font-extrabold sm:text-[0.9375rem]' : 'text-[0.75rem] font-bold tracking-[0.0375rem] uppercase'} ${index >= step && variant === 'checkout' ? 'opacity-55' : ''}`}>{label}</span>
          </div>
          {index < steps[variant].length - 1 && <span aria-hidden="true" className={`h-[3px] min-w-2 flex-1 rounded-full bg-bordo ${variant === 'checkout' ? 'w-9 sm:flex-none' : '-translate-y-2.5'} ${index >= step - 1 ? 'opacity-25' : ''}`} />}
        </li>
      ))}
    </ol>
  )
}
export default ProgressSteps
