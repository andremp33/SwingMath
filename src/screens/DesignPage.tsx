import { Bookmark, Plus, Save, Star } from 'lucide-react'
import { useState } from 'react'
import { emptyLead, type Position } from '../domain/types'
import { useT } from '../i18n'
import { Badge, Button, Card, CardTitle, EmptyState, IconButton, NumberField, PageTitle, Segmented, Select, TextField, Toggle } from '../ui/basics'
import { LeadControl, RacketDiagram } from '../ui/lead'
import { FeelRings, SpecTable } from '../ui/specs'

/** Every primitive in one place: the design system check (/design). */
export function DesignPage() {
  const t = useT()
  const [on, setOn] = useState(true)
  const [seg, setSeg] = useState<'a' | 'b'>('a')
  const [n, setN] = useState<number | undefined>(305)
  const [lead, setLead] = useState({ ...emptyLead(), tip: 3, threeNine: 4 })
  const [sel, setSel] = useState<Position>('tip')
  const swatches = ['bg', 'surface', 'surface-2', 'border', 'border-input', 'text', 'text-muted', 'accent', 'accent-text', 'danger', 'success', 'warning']

  return (
    <>
      <PageTitle>{t.design.title}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Colour roles</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {swatches.map((s) => (
              <div key={s}>
                <div className="h-10 rounded-md border border-border" style={{ background: `var(--c-${s})` }} />
                <div className="mt-1 text-muted">{s}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Type</CardTitle>
          <p className="text-display font-extrabold">Display 40</p>
          <p className="text-xl font-bold">Title 28</p>
          <p className="text-lg font-semibold">Heading 20</p>
          <p className="text-base">Body 16 — tabular <span className="num">305,0 g · 320,0 mm</span></p>
          <p className="text-sm text-muted">Small 14 muted</p>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Label 12</p>
        </Card>
        <Card className="space-y-3">
          <CardTitle>Buttons</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Save}>Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="lg" variant="primary">Large</Button>
            <IconButton icon={Star} label="Icon" />
            <IconButton icon={Bookmark} label="Active" active />
            <Badge>Stock</Badge>
            <Badge tone="accent">Mine</Badge>
            <Badge tone="pro">Pro</Badge>
          </div>
        </Card>
        <Card className="space-y-3">
          <CardTitle>Inputs</CardTitle>
          <TextField label="Text" value="Match day" onChange={() => {}} />
          <TextField label="Text with error" value="" onChange={() => {}} error={t.errors.required} />
          <NumberField label="Number" unit="g" min={150} max={450} value={n} onChange={setN} />
          <Select label="Select" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Option A' }]} />
          <Toggle label="Toggle" hint="+16 g" checked={on} onChange={setOn} />
          <Segmented label="Segmented" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]} />
        </Card>
        <Card>
          <CardTitle>Lead</CardTitle>
          <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4">
            <RacketDiagram lead={lead} selected={sel} onSelect={setSel} />
            <LeadControl position={sel} value={lead[sel]} onChange={(g) => setLead({ ...lead, [sel]: g })} selected />
          </div>
        </Card>
        <Card>
          <CardTitle>Specs and feel</CardTitle>
          <SpecTable
            rows={[
              { key: 'w', label: 'Weight', value: '321,0', unit: 'g', delta: 16 },
              { key: 'b', label: 'Balance', value: '330,2', unit: 'mm', sub: '4,0 pts HL', delta: 10.2 },
              { key: 'tw', label: 'Twistweight', value: '13,23', muted: true, sub: 'estimated' },
            ]}
          />
          <div className="mt-4">
            <FeelRings feel={{ power: 62, stability: 55, manoeuvrability: 48, spin: 51, control: 66, plow: 70 }} compare={{ power: 55, stability: 50, manoeuvrability: 58, spin: 57, control: 63, plow: 61 }} labels={['A', 'B']} />
          </div>
        </Card>
        <div className="lg:col-span-2">
          <EmptyState icon={Plus} text="Empty state" action={<Button variant="primary">Action</Button>} />
        </div>
      </div>
    </>
  )
}
