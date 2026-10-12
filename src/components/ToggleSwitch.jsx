function ToggleSwitch({ checked, onChange, label, large = false }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative shrink-0 rounded-full border-[2.4px] border-bordo ${large ? 'h-8 w-14' : 'h-7 w-12'} ${checked ? 'bg-amarillo' : 'bg-crema'}`}>
    <span aria-hidden="true" className={`absolute rounded-full bg-bordo ${large ? 'top-[0.1875rem] size-5' : 'top-0.5 size-4.5'} ${checked ? large ? 'left-[1.6875rem]' : 'left-[1.375rem]' : 'left-0.5'}`} />
  </button>
}
export default ToggleSwitch
