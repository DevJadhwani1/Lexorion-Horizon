import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import {
  getOrganization,
  updateOrganization,
  updateSettings,
  getMembers,
  getInvitations,
  createInvitation,
  type Organization,
  type Settings,
  type Member,
  type Invitation,
} from "../admin/adminApi";
import {
  createOrganizationWorkspace,
  getOrganizationWorkspaces,
  type OrganizationWorkspace,
  type CreateWorkspaceInput,
} from "../admin/workspaceApi";
import {
  getEffectiveEntitlements,
  type EffectiveEntitlements,
} from "../entitlements/entitlementApi";
import type { OnboardingSetupStatus, OnboardingState } from "./onboardingTypes";

export function useOnboarding() {
  const auth = useAuth();
  const workspaceContext = useWorkspace();
  const organizationSlug = auth.organization?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [entitlements, setEntitlements] = useState<EffectiveEntitlements>([]);
  const [accessReviewed, setAccessReviewed] = useState(() => {
    try {
      return sessionStorage.getItem(`lexorion.access-reviewed.${organizationSlug}`) === "true";
    } catch {
      return false;
    }
  });
  const [finished, setFinished] = useState(() => {
    try {
      return sessionStorage.getItem(`lexorion.onboarding-finished.${organizationSlug}`) === "true";
    } catch {
      return false;
    }
  });

  const load = useCallback(async () => {
    if (!auth.organization) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [org, wsList, memberList, inviteList, entList] = await Promise.all([
        getOrganization(),
        getOrganizationWorkspaces().catch(() => []),
        getMembers().catch(() => []),
        getInvitations().catch(() => []),
        getEffectiveEntitlements().catch(() => []),
      ]);

      setOrganization(org);
      setWorkspaces(wsList);
      setMembers(memberList);
      setInvitations(inviteList);
      setEntitlements(entList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organization setup data");
    } finally {
      setLoading(false);
    }
  }, [auth.organization]);

  useEffect(() => {
    void load();
  }, [load]);

  // Step 1: Complete if verified contact details and required info are present
  const step1Complete = Boolean(
    organization &&
      organization.name &&
      organization.primaryEmail &&
      (organization.primaryPhone ||
        organization.legalName ||
        organization.industry ||
        organization.settings?.country ||
        organization.settings?.currency ||
        sessionStorage.getItem(`lexorion.details-completed.${organizationSlug}`) === "true")
  );

  // Step 2: Locked until Step 1 complete; complete when an active workspace exists
  const step2Locked = !step1Complete;
  const activeWorkspaces = workspaces.filter((w) => w.status === "ACTIVE");
  const step2Complete = activeWorkspaces.length > 0;

  // Step 3: Locked until Step 2 complete; complete when access is set up or confirmed
  const step3Locked = !step2Complete;
  const step3Complete =
    step2Complete &&
    (members.length > 1 || invitations.length > 0 || accessReviewed);

  // Step 4: Locked until Steps 1 & 2 complete; complete when finished or active workspace entered
  const step4Locked = !step1Complete || !step2Complete;
  const isSelectedActive = Boolean(
    workspaceContext.workspace && workspaceContext.workspace.status === "ACTIVE"
  );
  const step4Complete =
    !step4Locked && (finished || (step2Complete && isSelectedActive));

  const completedCount = [
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
  ].filter(Boolean).length;
  const totalSteps = 4;
  const percentage = Math.round((completedCount / totalSteps) * 100);

  let setupStatus: OnboardingSetupStatus = "ACTION_REQUIRED";
  if (step4Complete || (step2Complete && isSelectedActive)) {
    setupStatus = "COMPLETED";
  } else if (completedCount >= 3) {
    setupStatus = "READY_FOR_REVIEW";
  } else if (completedCount > 0) {
    setupStatus = "IN_PROGRESS";
  }

  const isConfigured = Boolean(
    workspaces.length > 0 &&
      isSelectedActive &&
      (finished || sessionStorage.getItem(`lexorion.onboarding-in-progress.${organizationSlug}`) !== "true")
  );

  const saveDetails = async (details: Partial<Organization>) => {
    const updated = await updateOrganization(details);
    setOrganization(updated);
    try {
      sessionStorage.setItem(`lexorion.details-completed.${organizationSlug}`, "true");
    } catch {
      /* storage may be unavailable */
    }
    return updated;
  };

  const saveOrgSettings = async (settings: Partial<Settings>) => {
    const updated = await updateSettings(settings);
    setOrganization(updated);
    try {
      sessionStorage.setItem(`lexorion.details-completed.${organizationSlug}`, "true");
    } catch {
      /* storage may be unavailable */
    }
    return updated;
  };

  const createWorkspace = async (input: CreateWorkspaceInput) => {
    const created = await createOrganizationWorkspace(input);
    setWorkspaces((prev) => [...prev, created]);
    await workspaceContext.reload({ select: created.key });
    return created;
  };

  const invite = async (email: string, role: string) => {
    const created = await createInvitation(email, role);
    setInvitations((prev) => [...prev, created]);
    return created;
  };

  const confirmAccessSolo = () => {
    try {
      sessionStorage.setItem(`lexorion.access-reviewed.${organizationSlug}`, "true");
    } catch {
      /* storage unavailable */
    }
    setAccessReviewed(true);
  };

  const finishOnboarding = () => {
    const firstWs = activeWorkspaces[0] ?? workspaces[0];
    if (firstWs) {
      workspaceContext.selectWorkspace(firstWs.key);
    }
    try {
      sessionStorage.setItem(`lexorion.onboarding-finished.${organizationSlug}`, "true");
      sessionStorage.removeItem(`lexorion.onboarding-in-progress.${organizationSlug}`);
    } catch {
      /* storage unavailable */
    }
    setFinished(true);
  };

  const state: OnboardingState = {
    loading,
    error,
    organization,
    workspaces,
    members,
    invitations,
    entitlements,
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
    step2Locked,
    step3Locked,
    step4Locked,
    completedCount,
    totalSteps,
    percentage,
    setupStatus,
    isConfigured,
  };

  return {
    ...state,
    reload: load,
    saveDetails,
    saveOrgSettings,
    createWorkspace,
    invite,
    confirmAccessSolo,
    finishOnboarding,
  };
}
