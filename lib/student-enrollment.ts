import { hasSupabaseConfig, supabaseFetch } from './store';

export type EnrollmentInput = { studentId: string; studentName: string; batchId: string; accountId: string };
type StudentRow = { student_id: string; name: string; batch_id: string; account_id: string | null };
export class EnrollmentError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function parseEnrollment(value: unknown): EnrollmentInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EnrollmentError('Enrollment must be an object.', 400);
  const row = value as Record<string, unknown>;
  const field = (key: string, max: number) => {
    const v = row[key];
    if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/.test(v)) throw new EnrollmentError(`${key} is required and must be valid text (maximum ${max} characters).`, 400);
    return v.trim();
  };
  return { studentId: field('studentId', 200), studentName: field('studentName', 160), batchId: field('batchId', 200), accountId: field('accountId', 200) };
}

async function readRows<T>(table: string, query: Record<string, string>): Promise<T[]> {
  const response = await supabaseFetch(`/rest/v1/${table}?${new URLSearchParams(query)}`);
  if (!response.ok) throw new EnrollmentError('Could not verify enrollment setup. Please retry.', 503);
  return response.json() as Promise<T[]>;
}

function verifyExisting(row: StudentRow, input: EnrollmentInput) {
  if (row.batch_id !== input.batchId || row.student_id !== input.studentId || row.name !== input.studentName || row.account_id !== input.accountId) {
    throw new EnrollmentError('This student ID already exists with a different name or account. Ask the mentor to correct the configuration or existing enrollment; it was not changed.', 409);
  }
}

// Call only after authenticating the installation request. No student Auth user is created.
export async function enrollStudent(input: EnrollmentInput) {
  if (!hasSupabaseConfig()) throw new EnrollmentError('Enrollment requires Supabase configuration.', 503);
  const query = { select: 'student_id,name,batch_id,account_id', batch_id: `eq.${input.batchId}`, student_id: `eq.${input.studentId}` };
  const [batches, accounts, students] = await Promise.all([
    readRows<{ id: string; status: string }>('batches', { select: 'id,status', id: `eq.${input.batchId}` }),
    readRows<{ id: string }>('shared_accounts', { select: 'id', id: `eq.${input.accountId}` }),
    readRows<StudentRow>('batch_students', query),
  ]);
  if (!batches.length) throw new EnrollmentError('Unknown batch. Ask the mentor to create the batch first.', 400);
  if (!accounts.length) throw new EnrollmentError('Unknown shared account. Check the account ID with the mentor.', 400);
  if (students.length) {
    verifyExisting(students[0], input);
    return { created: false, student: input };
  }
  if (batches[0].status !== 'active') throw new EnrollmentError('New students cannot enroll in an archived batch.', 409);
  const response = await supabaseFetch('/rest/v1/batch_students?on_conflict=batch_id,student_id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ student_id: input.studentId, name: input.studentName, batch_id: input.batchId, account_id: input.accountId }),
  });
  if (!response.ok) throw new EnrollmentError('Could not save enrollment. Please retry.', 503);
  const inserted = await response.json() as StudentRow[];
  // The composite primary key handles concurrent installs. Never overwrite a conflicting row.
  const saved = inserted.length ? inserted : await readRows<StudentRow>('batch_students', query);
  if (saved.length !== 1) throw new EnrollmentError('Could not verify saved enrollment. Please retry.', 503);
  verifyExisting(saved[0], input);
  return { created: inserted.length === 1, student: input };
}
