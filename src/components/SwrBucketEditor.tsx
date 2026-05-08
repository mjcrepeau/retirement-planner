import { useState } from 'react';
import { SwrBucket } from '../types';
import { NumberInput } from './NumberInput';
import { validateBuckets } from '../utils/swrBuckets';
import { v4 as uuidv4 } from 'uuid';

interface SwrBucketEditorProps {
  buckets: SwrBucket[];
  onChange: (buckets: SwrBucket[]) => void;
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";
const inputErrorClassName = "w-full px-3 py-2 border border-red-500 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white";

interface DraftBucket {
  startAge: number;
  endAge: number;
  rate: number;
}

export function SwrBucketEditor({ buckets, onChange }: SwrBucketEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null); // bucket id or 'new'
  const [draft, setDraft] = useState<DraftBucket>({ startAge: 65, endAge: 75, rate: 0.05 });
  const [draftErrors, setDraftErrors] = useState<string[]>([]);

  const validation = validateBuckets(buckets);

  const startAdd = () => {
    setEditingId('new');
    setDraft({ startAge: 65, endAge: 75, rate: 0.05 });
    setDraftErrors([]);
  };

  const startEdit = (b: SwrBucket) => {
    setEditingId(b.id);
    setDraft({ startAge: b.startAge, endAge: b.endAge, rate: b.rate });
    setDraftErrors([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftErrors([]);
  };

  const saveEdit = () => {
    // Build the new buckets array with the draft applied
    const next: SwrBucket[] = editingId === 'new'
      ? [...buckets, { id: uuidv4(), ...draft }]
      : buckets.map(b => b.id === editingId ? { ...b, ...draft } : b);

    // Validate the proposed array
    const result = validateBuckets(next);
    const myIndex = editingId === 'new'
      ? next.length - 1
      : next.findIndex(b => b.id === editingId);
    const myErrors = result.errors[myIndex] ?? [];

    if (myErrors.length > 0) {
      setDraftErrors(myErrors);
      return;
    }

    onChange(next);
    setEditingId(null);
    setDraftErrors([]);
  };

  const deleteBucket = (id: string) => {
    onChange(buckets.filter(b => b.id !== id));
    if (editingId === id) cancelEdit();
  };

  const editorRow = (
    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Age</label>
          <NumberInput
            value={draft.startAge}
            onChange={v => setDraft(d => ({ ...d, startAge: v }))}
            min={0} max={120} defaultValue={65}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Age</label>
          <NumberInput
            value={draft.endAge}
            onChange={v => setDraft(d => ({ ...d, endAge: v }))}
            min={0} max={120} defaultValue={75}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rate (%)</label>
          <NumberInput
            value={draft.rate}
            onChange={v => setDraft(d => ({ ...d, rate: v }))}
            min={0} max={50} isPercentage decimals={1} defaultValue={0.05}
            className={draftErrors.length > 0 ? inputErrorClassName : inputClassName}
          />
        </div>
      </div>
      {draftErrors.length > 0 && (
        <ul className="text-xs text-red-500 space-y-0.5 list-disc list-inside">
          {draftErrors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancelEdit}
          className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveEdit}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {editingId === 'new' ? 'Add' : 'Save'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Withdrawal Rate Buckets <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Override SWR for specific age ranges. Higher rates in early retirement, lower in later years.
          Uncovered ages use the Safe Withdrawal Rate above.
        </p>
      </div>

      {buckets.length > 0 && (
        <ul className="space-y-1">
          {buckets.map((b, i) => {
            const rowErrors = validation.errors[i] ?? [];
            const isEditing = editingId === b.id;
            return (
              <li key={b.id}>
                {isEditing ? (
                  editorRow
                ) : (
                  <div className={`flex items-center justify-between p-2 rounded-md border text-sm ${rowErrors.length > 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        Age {b.startAge}–{b.endAge}
                      </span>
                      <span className="ml-3 text-gray-600 dark:text-gray-300">
                        Rate: {(b.rate * 100).toFixed(1)}%
                      </span>
                      {rowErrors.length > 0 && (
                        <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                          {rowErrors.map((e, k) => <li key={k}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteBucket(b.id)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editingId === 'new' && editorRow}

      {editingId !== 'new' && (
        <button
          type="button"
          onClick={startAdd}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add Bucket
        </button>
      )}
    </div>
  );
}
