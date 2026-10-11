import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SPECIES, type SpeciesId } from '../domain/species';
import { adoptPet } from '../lib/api';

export default function Adopt() {
  const nav = useNavigate();
  const [species, setSpecies] = useState<SpeciesId>('fox');
  const [color, setColor] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await adoptPet(species, color, name);
      nav('/home', { replace: true });
    } catch {
      setError("Couldn't adopt right now. Try again!");
    }
  }

  return (
    <main>
      <h1>Adopt your pet</h1>
      <form onSubmit={submit}>
        <label>Animal</label>
        <select value={species} onChange={(e) => setSpecies(e.target.value as SpeciesId)}>
          {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label>Color</label>
        <select value={color} onChange={(e) => setColor(Number(e.target.value))}>
          <option value={0}>Classic</option><option value={1}>Pastel</option><option value={2}>Midnight</option>
        </select>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
        <button>Adopt!</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
