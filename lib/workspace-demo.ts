import { WorkspaceData } from "./workspace-types";

export function demoWorkspace(): WorkspaceData {
  const names = ["Aarav Kumar", "Diya Raman", "Kavin Raj", "Meera S", "Nila Devi", "Rohan Das", "Sara Ali", "Vishal K"];
  const projects = ["Campus Connect", "Mindful Minutes", "Local Harvest", "Study Circle", "Expense Buddy", "Skill Exchange", "Green Routes", "Reading Room"];
  const descriptions = ["A home for campus events and communities.", "Small daily habits for better wellbeing.", "Connect local growers with nearby buyers.", "Find a study partner and learn together.", "A simpler way to track everyday spending.", "Trade skills with your local community.", "Plan a greener everyday commute.", "A shared bookshelf for curious readers."];
  const data: WorkspaceData = {
    batches: [{ id: "batch-2", name: "Batch 2", status: "active" }, { id: "batch-1", name: "Batch 1", status: "archived" }],
    students: names.map((name, i) => ({ batchId: "batch-2", studentId: `b2-${i + 1}`, name, accountId: i < 4 ? "studio-01" : i < 6 ? "studio-02" : "studio-03" })),
    accounts: [{ id: "studio-01", name: "Studio account 01", capacity: 4 }, { id: "studio-02", name: "Studio account 02", capacity: 2 }, { id: "studio-03", name: "Studio account 03", capacity: 2 }, { id: "legacy-01", name: "Batch 1 account", capacity: 4 }],
    projects: projects.map((name, i) => ({ id: `project-${i + 1}`, batchId: "batch-2", studentId: `b2-${i + 1}`, name, description: descriptions[i], status: i === 1 ? "review" : i === 6 ? "planning" : "building", progress: [68, 86, 42, 74, 55, 62, 24, 71][i], repositoryUrl: null })),
    usage: [], mode: "demo", setupRequired: false,
  };
  for (let day = 5; day <= 10; day++) {
    for (let i = 0; i < 7; i++) {
      data.usage.push({ eventId: `sample-${day}-${i}`, batchId: "batch-2", studentId: `b2-${i + 1}`, projectId: `project-${i + 1}`, accountId: data.students[i].accountId!, sessionId: `session-${day}-${i}`, occurredAt: `2026-10-${String(day).padStart(2, "0")}T09:00:00Z`, inputTokens: 9500 + day * 720 + i * 1370, outputTokens: 2200 + i * 440 + day * 125, cachedInputTokens: 3100 + i * 420, source: "sample" });
    }
  }
  data.usage.push({ eventId: "sample-unattributed", batchId: "batch-2", studentId: null, projectId: null, accountId: "studio-01", sessionId: "unassigned-session", occurredAt: "2026-10-10T11:00:00Z", inputTokens: 18000, outputTokens: 4200, cachedInputTokens: 0, source: "sample" });
  for (const [i, name] of ["Noor", "Aisha", "Rahul"].entries()) {
    data.students.push({ batchId: "batch-1", studentId: name.toLowerCase(), name, accountId: "legacy-01" });
    data.projects.push({ id: `legacy-project-${i}`, batchId: "batch-1", studentId: name.toLowerCase(), name: ["Portfolio Builder", "Community Board", "Task Tracker"][i], description: "Batch 1 capstone project.", status: "shipped", progress: 100, repositoryUrl: null });
  }
  return data;
}
