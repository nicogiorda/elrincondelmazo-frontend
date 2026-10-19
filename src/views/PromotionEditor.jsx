import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/AccountLayout.jsx'
import FormField from '../components/FormField.jsx'
import PromotionCard from '../components/PromotionCard.jsx'
import ToggleSwitch from '../components/ToggleSwitch.jsx'
import { promotionKinds, emptyPromotion, promotionStatus, promotionPeriod, promotionCondition } from '../data/promotionMocks.js'
import { productTypeLabels } from '../data/accountMocks.js'
import { paymentMethods } from '../data/paymentMethods.js'

function PromotionEditor({ user, onLogout, cartCount, isNew = false, promotion, onSave,
  collections = [], products = [], collectionsLoading, productsLoading, collectionsError, productsError }) {
    const [form, setForm] = useState(() => {
      const initial = isNew ? { ...emptyPromotion, collectionId: '', productId: '' } : promotion;
      return { ...initial, productType: initial.kind === 'type' && !productTypeLabels[initial.productType]
        ? 'CARTA' : initial.productType };
    })
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const saveRequest = useRef(false);

  // Se usan los mismos datos de App. Solo la condición elegida depende de ellos.
  const dataLoading = form.kind === 'collection' ? collectionsLoading : form.kind === 'product' ? productsLoading : false;
  const dataError = form.kind === 'collection' ? collectionsError : form.kind === 'product' ? productsError : '';
  const options = form.kind === 'collection' ? collections : products;
  const selectedId = form.kind === 'collection' ? form.collectionId : form.productId;
  const needsSelection = ['collection', 'product'].includes(form.kind);
  const missingSelection = needsSelection && !options.some((item) => item.id === Number(selectedId));

  function changeField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'kind' && value === 'type' && !productTypeLabels[current.productType]) {
        next.productType = 'CARTA';
      }
      if (field === 'startDate' || field === 'endDate') {
        const original = promotion?.[field];
        next[field] = value && original?.slice(0, 10) === value ? original : value;
      }
      return next;
    });
  }

  async function submitPromotion(event) {
    event.preventDefault();
    // La referencia bloquea incluso dos eventos antes del siguiente render.
    if (saveRequest.current || dataLoading || dataError || missingSelection) return;
    saveRequest.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(form);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      saveRequest.current = false;
      setSaving(false);
    }
  }
  const condition = promotionCondition(form, collections, products, paymentMethods)
  
  return <AccountLayout user={user} cartCount={cartCount} onLogout={onLogout} activeView="promotions">
    <div className="flex flex-col items-start gap-2.5"><Link to="/promociones" className="text-[0.9375rem] font-bold underline">← Promociones</Link><h1 className="font-display text-[4rem] leading-[3.52rem] font-black uppercase">{isNew ? 'Nueva promoción' : 'Editar promoción'}</h1></div>
    <div className="grid min-w-0 items-start gap-7 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <form onSubmit={submitPromotion} className="flex min-w-0 flex-col gap-5.5 rounded-[1.75rem] border-[2.4px] border-bordo bg-papel p-7 shadow-[0.5rem_0.5rem_0_var(--color-bordo)] [&_textarea]:min-h-[4.95rem] [&>label]:max-w-[40.2rem]">
        <FormField id="promotion-name" label="Nombre" required value={form.name} onChange={(event) => changeField('name', event.target.value)} />
        <FormField id="promotion-description" label={<>Descripción<span className="mt-2 block font-semibold tracking-normal normal-case opacity-70">(opcional)</span></>} multiline value={form.description} onChange={(event) => changeField('description', event.target.value)} />
        <fieldset className="min-w-0"><legend className="mb-2.5 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Tipo de promoción</legend><div className="grid max-w-[40.2rem] gap-2.5 sm:grid-cols-2 xl:grid-cols-4">{promotionKinds.map((kind) => <button key={kind.value} type="button" aria-pressed={form.kind === kind.value} onClick={() => changeField('kind', kind.value)} className={`flex min-w-0 flex-col gap-0.5 rounded-2xl border-[2.4px] border-bordo px-3.5 py-3 text-left ${form.kind === kind.value ? 'bg-bordo text-crema shadow-[0.25rem_0.25rem_0_var(--color-rosa)]' : 'bg-crema'}`}><strong className="text-[0.9375rem]">{kind.label}</strong><span className="text-[0.75rem] opacity-85">{kind.description}</span></button>)}</div></fieldset>
        <section aria-labelledby="promotion-condition-heading" className="flex min-w-0 flex-col gap-4.5 rounded-[1.25rem] border-[2.4px] border-bordo bg-crema p-5 [&_input]:bg-papel">
          <h2 id="promotion-condition-heading" className="font-display text-[1.625rem] leading-[1.625rem] font-black uppercase">Condición</h2>
          <div className="max-w-[14.8rem]"><FormField id="promotion-discount" label="Descuento (%)" type="number" min="0.01" max="100" step="0.01" required value={form.discount} onChange={(event) => changeField('discount', Number(event.target.value))} /></div>
          {form.kind === 'quantity' && <div className="max-w-[14.8rem]"><FormField id="promotion-quantity" label="Cantidad mínima" type="number" min="1" step="1" required value={form.minimumQuantity} onChange={(event) => changeField('minimumQuantity', Number(event.target.value))} /></div>}
          {['quantity', 'type'].includes(form.kind) && <fieldset><legend className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">Aplica a</legend><div className="flex flex-wrap gap-2">{[...(form.kind === 'quantity' ? [['', 'Todos']] : []), ...Object.entries(productTypeLabels)].map(([value, label]) => <button key={value} type="button" aria-pressed={form.productType === value} onClick={() => changeField('productType', value)} className={`rounded-full border-[1.6px] border-bordo px-4 py-2.25 text-[0.875rem] font-bold ${form.productType === value ? 'bg-bordo text-crema' : 'bg-papel'}`}>{label}</button>)}</div></fieldset>}
          {form.kind === 'minimum' && <FormField id="promotion-minimum" label="Monto mínimo (ARS)" type="number" min="0.01" step="0.01" required value={form.minimumAmount} onChange={(event) => changeField('minimumAmount', Number(event.target.value))} />}
         
{['collection', 'payment', 'product'].includes(form.kind) && (
  <label className="flex min-w-0 flex-col gap-2">
    <span className="text-[0.8125rem] font-extrabold tracking-[0.04875rem] uppercase">
      {form.kind === 'collection'
        ? 'Colección'
        : form.kind === 'payment'
          ? 'Medio de pago'
          : 'Producto'}
    </span>

    <select
      required
      disabled={dataLoading || Boolean(dataError)}
      value={
        form.kind === 'collection'
          ? form.collectionId
          : form.kind === 'payment'
            ? form.paymentMethod
            : form.productId
      }
      onChange={(event) =>
        changeField(
          form.kind === 'collection'
            ? 'collectionId'
            : form.kind === 'payment'
              ? 'paymentMethod'
              : 'productId',
          form.kind === 'payment'
            ? event.target.value
            : event.target.value === '' ? '' : Number(event.target.value)
        )
      }
      className="min-w-0 rounded-[0.875rem] border-[2.4px] border-bordo bg-papel px-4 py-3.5 text-[1.0625rem] font-semibold"
    >
      <option value="">Seleccioná una opción</option>
      {missingSelection && selectedId !== '' && <option value={selectedId} disabled>Selección anterior no disponible ({selectedId})</option>}
      {(form.kind === 'collection'
        ? collections.map((item) => ({
            value: item.id,
            label: item.name,
          }))
        : form.kind === 'payment'
          ? paymentMethods
          : products.map((item) => ({
              value: item.id,
              label: item.name,
            }))
      ).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  </label>
)}

          {dataLoading && <p role="status">Cargando {form.kind === 'collection' ? 'colecciones' : 'productos'}…</p>}
          {dataError && <p role="alert">{dataError}</p>}
          {needsSelection && !dataLoading && !dataError && !options.length && <p role="status">No hay {form.kind === 'collection' ? 'colecciones' : 'productos'} disponibles.</p>}
          {missingSelection && selectedId !== '' && !dataLoading && !dataError && <p role="alert">La selección anterior no está disponible en los datos cargados. Seleccioná otra opción.</p>}

        </section>
        <div className="flex items-center gap-3.5"><ToggleSwitch large checked={form.stackable} onChange={(value) => changeField('stackable', value)} label="Acumulable" /><div><p className="font-extrabold">Acumulable</p><p className="text-[0.8125rem] leading-[1.096875rem] opacity-85">Se suma a las demás promociones que apliquen.</p></div></div>
        <div className="grid max-w-[40.2rem] grid-cols-1 gap-4.5 sm:grid-cols-2"><FormField id="promotion-start" label="Inicio" type="date" required value={form.startDate.slice(0, 10)} onChange={(event) => changeField('startDate', event.target.value)} /><FormField id="promotion-end" label={<>Fin<span className="mt-2 block font-semibold tracking-normal normal-case opacity-70">(opcional)</span></>} type="date" min={form.startDate.slice(0, 10) || undefined} value={form.endDate.slice(0, 10)} onChange={(event) => changeField('endDate', event.target.value)} /></div>
        {saveError && <p role="alert" className="font-bold text-rojo">{saveError}</p>}
        <div className="flex flex-wrap justify-end gap-3"><Link to="/promociones" className="rounded-full border-[2.4px] border-bordo px-6 py-3.5 text-base font-extrabold">Cancelar</Link><button type="submit" disabled={saving || dataLoading || Boolean(dataError) || missingSelection} className="rounded-full border-[2.4px] border-bordo bg-bordo px-7 py-3.5 text-base font-extrabold text-crema">{saving ? 'Guardando…' : isNew ? 'Crear promoción' : 'Guardar cambios'}</button></div>
      </form>
      <aside aria-label="Vista previa de promoción" className="flex min-w-0 flex-col gap-3 wrap-anywhere">
        <h2 className="text-[0.8125rem] font-extrabold tracking-[0.065rem] uppercase">Así se ve en la home</h2>
        <div className="rounded-[1.625rem] border-[2.4px] border-bordo bg-amarillo p-4 [&_h3]:whitespace-normal [&_article]:min-w-0 [&_h3]:wrap-anywhere [&_p]:wrap-anywhere"><PromotionCard promotion={{ discount: `${form.discount}%`, title: form.name, description: form.description }} /></div>
        <div className="flex flex-col gap-2 rounded-[1.25rem] border-[2.4px] border-bordo p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[0.75rem] font-extrabold tracking-[0.045rem] uppercase">Estado al guardar</h3><span className="rounded-full border-[1.6px] border-bordo bg-bordo px-2.5 py-0.75 text-[0.6875rem] font-extrabold text-crema uppercase">{form.startDate ? promotionStatus(form) : 'Sin configurar'}</span></div><p className="text-[0.875rem] leading-[1.225rem]">{condition}</p><p className="text-[0.8125rem] font-semibold opacity-80">{promotionPeriod(form)}</p></div>
      </aside>
    </div>
  </AccountLayout>
}
export default PromotionEditor
