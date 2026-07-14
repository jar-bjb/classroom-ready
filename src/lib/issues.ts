import type { ResponseValue } from "@/generated/prisma/client";

type IssueDisplayInput = {
  title: string;
  room?: { code: string } | null;
  response?: {
    value: ResponseValue | string;
    item?: { prompt: string } | null;
  } | null;
};

const explicitFailureLabels = [
  { text: "Kondisi tidak terpenuhi", label: "Kondisi tidak terpenuhi" },
  { text: "Kondisi tidak dapat diverifikasi", label: "Kondisi tidak dapat diverifikasi" },
  { text: "Tidak terpenuhi", label: "Kondisi tidak terpenuhi" },
  { text: "Tidak dapat diverifikasi", label: "Kondisi tidak dapat diverifikasi" },
];

function splitRoomTitle(title: string, roomCode?: string | null) {
  const normalizedCode = roomCode?.trim();
  if (normalizedCode && title.startsWith(`${normalizedCode} - `)) {
    return { roomPrefix: `${normalizedCode} - `, condition: title.slice(normalizedCode.length + 3) };
  }

  const match = title.match(/^([^-]+?)\s+-\s+(.+)$/);
  if (!match) return { roomPrefix: "", condition: title };

  return { roomPrefix: `${match[1].trim()} - `, condition: match[2].trim() };
}

export function issueFailureLabel(value?: ResponseValue | string | null) {
  return value === "NA" ? "Kondisi tidak dapat diverifikasi" : "Kondisi tidak terpenuhi";
}

export function issueResponseValueLabel(value?: ResponseValue | string | null) {
  const labels: Record<string, string> = {
    OK: "OK",
    NOT_OK: "Tidak OK",
    NA: "N/A kritikal",
  };

  return value ? labels[value] ?? value : "-";
}

function issueConditionTitle(prompt: string, value?: ResponseValue | string | null) {
  return `${prompt.trim()}: ${issueFailureLabel(value)}`;
}

function normalizeIssueCondition(condition: string, value?: ResponseValue | string | null) {
  const trimmed = condition.trim();

  for (const { text, label } of explicitFailureLabels) {
    const prefix = `${text}:`;
    if (trimmed.startsWith(prefix)) {
      const prompt = trimmed.slice(prefix.length).trim();
      return prompt ? `${prompt}: ${label}` : label;
    }
  }

  for (const { text, label } of explicitFailureLabels) {
    const suffix = `: ${text}`;
    if (trimmed.endsWith(suffix)) {
      const prompt = trimmed.slice(0, -suffix.length).trim();
      return prompt ? `${prompt}: ${label}` : label;
    }
  }

  return issueConditionTitle(trimmed, value);
}

export function buildIssueTitle(roomCode: string, prompt: string, value: ResponseValue | string) {
  return `${roomCode} - ${issueConditionTitle(prompt, value)}`;
}

export function issueDisplayTitle(issue: IssueDisplayInput) {
  if (issue.response?.item?.prompt) {
    const roomPrefix = issue.room?.code ? `${issue.room.code} - ` : "";
    return `${roomPrefix}${issueConditionTitle(issue.response.item.prompt, issue.response.value)}`;
  }

  const { roomPrefix, condition } = splitRoomTitle(issue.title, issue.room?.code);
  return `${roomPrefix}${normalizeIssueCondition(condition, issue.response?.value)}`;
}
