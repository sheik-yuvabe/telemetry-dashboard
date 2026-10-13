import { createHash } from 'node:crypto';
import { FeedbackPayload } from './types';
import { hasSupabaseConfig, supabaseFetch } from './store';

// Caller authenticates ingestion and validates the complete feedback before this write.
export async function resolveReportProject(payload: FeedbackPayload): Promise<string | null> {
  if (!payload.project) return payload.projectId ?? null;
  if (!hasSupabaseConfig()) throw new Error('Automatic project registration requires Supabase.');
  const batch = payload.batchId ?? 'batch-1';
  const enrollment = new URLSearchParams({ select: 'student_id,name', batch_id: `eq.${batch}`, student_id: `eq.${payload.studentId}` });
  const enrolled = await supabaseFetch(`/rest/v1/batch_students?${enrollment}`);
  if (!enrolled.ok) throw new Error('Could not verify student enrollment.');
  const [student] = await enrolled.json();
  if (!student) throw new Error('Ask your mentor to enroll this student in the selected batch before sending reports.');
  // The enrolled name is mentor-controlled; project metadata cannot rename a learner.
  payload.studentName = student.name;
  const id = 'agent-' + createHash('sha256').update(JSON.stringify([batch, payload.studentId, payload.project.key])).digest('hex');
  const response = await supabaseFetch('/rest/v1/student_projects?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id, batch_id: batch, student_id: payload.studentId, name: payload.project.title, description: '', status: 'building', progress: 0 }),
  });
  if (!response.ok) throw new Error('Could not register the student project. Please retry.');
  // Verify even after a conflicting insert. Retries never reset an existing milestone/title.
  const query = new URLSearchParams({ select: 'id,batch_id,student_id', id: `eq.${id}` });
  const saved = await supabaseFetch(`/rest/v1/student_projects?${query}`);
  if (!saved.ok) throw new Error('Could not verify the registered project.');
  const [project] = await saved.json();
  if (!project || project.batch_id !== batch || project.student_id !== payload.studentId) throw new Error('Project ownership verification failed.');
  return id;
}
