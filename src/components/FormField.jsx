function FormField({ label, id, multiline = false, ...inputProps }) {
  const classes = 'w-full min-w-0 rounded-[0.875rem] border-[2.4px] border-bordo bg-crema px-4 py-3.5 text-[1.0625rem] font-semibold placeholder:text-bordo/50'
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-2">
      <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">{label}</span>
      {multiline ? <textarea id={id} className={`${classes} min-h-[7.85rem] resize-y text-base leading-[1.45rem] font-normal`} {...inputProps} /> : <input id={id} className={classes} {...inputProps} />}
    </label>
  )
}
export default FormField
