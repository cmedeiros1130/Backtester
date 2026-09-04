import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, Select, useToast } from './ui';

const NEW = '__new__';

/**
 * A picker that can also create what it is picking from.
 *
 * Nothing in LevelForge is pre-created, so the first time you file anything the
 * list behind this control is empty. Without a way to create from here, the
 * form would be a dead end -- so when there is nothing to choose, this drops
 * straight into a name field instead of showing an empty dropdown.
 */
export function PickerWithCreate({
  label, required, value, onChange, options, placeholder, hint,
  createLabel, createPlaceholder, onCreate, className,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  hint?: React.ReactNode;
  createLabel: string;
  createPlaceholder: string;
  /** Creates the record and resolves with its id. */
  onCreate: (name: string) => Promise<string>;
  className?: string;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const empty = options.length === 0;

  // With nothing to pick from, creating is the only sensible state.
  useEffect(() => { if (empty) setCreating(true); }, [empty]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const id = await onCreate(trimmed);
      onChange(id);
      setName('');
      setCreating(false);
      toast('good', `${createLabel} created.`);
    } catch (e: any) {
      toast('bad', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <Field
        label={label}
        required={required}
        className={className}
        hint={empty ? hint : undefined}
        aside={
          !empty && (
            <button type="button" onClick={() => { setCreating(false); setName(''); }}
              className="flex items-center gap-1 text-[10px] text-fg-faint hover:text-fg-muted">
              <X size={9} /> cancel
            </button>
          )
        }
      >
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            placeholder={createPlaceholder}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
          />
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={create}>
            Create
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} required={required} className={className}>
      <Select
        value={value ?? ''}
        onChange={(e) => (e.target.value === NEW ? setCreating(true) : onChange(e.target.value))}
        options={[
          ...options.map((o) => ({ value: o.id, label: o.name })),
          { value: NEW, label: `+ New ${createLabel.toLowerCase()}…` },
        ]}
        placeholder={placeholder}
      />
    </Field>
  );
}
