import type { Organization, Member, Invitation } from "../admin/adminApi";
import type { OrganizationWorkspace } from "../admin/workspaceApi";
import type { EffectiveEntitlements } from "../entitlements/entitlementApi";
import type { ReadinessItem } from "../readiness/readiness";

export type StepState = "completed" | "active" | "locked";

export type OnboardingSetupStatus = "ACTION_REQUIRED" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "COMPLETED";

export interface OnboardingState {
  loading: boolean;
  error: string | null;
  organization: Organization | null;
  workspaces: OrganizationWorkspace[];
  members: Member[];
  invitations: Invitation[];
  entitlements: EffectiveEntitlements;
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
  step4Complete: boolean;
  step2Locked: boolean;
  step3Locked: boolean;
  step4Locked: boolean;
  completedCount: number;
  totalSteps: number;
  percentage: number;
  setupStatus: OnboardingSetupStatus;
  isConfigured: boolean;
  pendingInvitationCount: number;
  steps: { details: ReadinessItem; workspace: ReadinessItem; access: ReadinessItem; finish: ReadinessItem };
}
