export interface TaskAssignee {
  memberId: string;
  memberName: string;
}

export function isCrewAssignmentRequested(input: {
  assignedMemberId?: string;
  assignedMemberName?: string;
}): boolean {
  const memberId = input.assignedMemberId?.trim().toLowerCase();
  const memberName = input.assignedMemberName?.trim().toLowerCase();
  return Boolean(
    (memberId && memberId !== "unassigned") ||
      (memberName && memberName !== "unassigned" && memberName !== "unassigned crew")
  );
}

export function requiresErpForCrewMutation(
  hasErp: boolean,
  assignment: { assignedMemberId?: string; assignedMemberName?: string }
): boolean {
  return !hasErp && isCrewAssignmentRequested(assignment);
}

export function getFreeWorkflowTaskAssignee(
  hasErp: boolean,
  studioOwner: TaskAssignee
): TaskAssignee | undefined {
  return hasErp ? undefined : studioOwner;
}
