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
  confirmSoloAccess,
  finishOnboarding as finishOnboardingRequest,
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
  deriveProductKeysFromEntitlements,
  type EffectiveEntitlements,
} from "../entitlements/entitlementApi";
import { accessDecision, finishDecision, organizationDetails, pendingInvitations, workspaceProducts } from "../readiness/readiness";
import type { OnboardingSetupStatus, OnboardingState } from "./onboardingTypes";

export function useOnboarding() {
  const auth = useAuth();
  const workspaceContext = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [entitlements, setEntitlements] = useState<EffectiveEntitlements>([]);

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

  const details = organizationDetails(organization);
  const workspace = workspaceProducts(workspaces, deriveProductKeysFromEntitlements(entitlements));
  const access = accessDecision(members, invitations, organization?.settings?.onboardingAccessDecision === "SOLO");
  const finish = finishDecision(Boolean(organization?.settings?.onboardingFinishedAt), [details, workspace, access]);
  const step1Complete = details.state === "COMPLETE";
  const step2Complete = workspace.state === "COMPLETE";
  const step3Complete = access.state === "COMPLETE";
  const step4Complete = finish.state === "COMPLETE";
  const step2Locked = !step1Complete;
  const step3Locked = !step2Complete;
  const step4Locked = !step1Complete || !step2Complete || !step3Complete;
  const steps = { details, workspace, access, finish };
  const completedCount = [step1Complete, step2Complete, step3Complete, step4Complete].filter(Boolean).length;
  const totalSteps = 4;
  const percentage = Math.round((completedCount / totalSteps) * 100);
  const activeWorkspaces = workspaces.filter((entry) => entry.status === "ACTIVE");
  const isSelectedActive = Boolean(workspaceContext.workspace && workspaceContext.workspace.status === "ACTIVE");

  let setupStatus: OnboardingSetupStatus = "ACTION_REQUIRED";
  if (step4Complete) setupStatus = "COMPLETED";
  else if (step1Complete && step2Complete && step3Complete) setupStatus = "READY_FOR_REVIEW";
  else if (completedCount > 0) setupStatus = "IN_PROGRESS";

  const isConfigured = step4Complete && isSelectedActive;

  const saveDetails = async (details: Partial<Organization>) => {
    try {
      const updated = await updateOrganization(details);
      setOrganization(updated);
      return updated;
    } catch (err) {
      throw err;
    }
  };

  const saveOrgSettings = async (settings: Partial<Settings>) => {
    try {
      const updated = await updateSettings(settings);
      setOrganization(updated);
      return updated;
    } catch (err) {
      throw err;
    }
  };

  const createWorkspace = async (input: CreateWorkspaceInput) => {
    try {
      const created = await createOrganizationWorkspace(input);
      setWorkspaces((prev) => [...prev, created]);
      await workspaceContext.reload({ select: created.key });
      return created;
    } catch (err) {
      throw err;
    }
  };

  const invite = async (email: string, role: string) => {
    try {
      const created = await createInvitation(email, role);
      setInvitations((prev) => [...prev, created]);
      return created;
    } catch (err) {
      throw err;
    }
  };

  const confirmAccessSolo = async () => {
    const updated = await confirmSoloAccess();
    setOrganization(updated);
    return updated;
  };

  const finishOnboarding = async () => {
    const updated = await finishOnboardingRequest();
    setOrganization(updated);
    const firstWs = activeWorkspaces[0] ?? workspaces[0];
    if (firstWs) workspaceContext.selectWorkspace(firstWs.key);
    return updated;
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
    pendingInvitationCount: pendingInvitations(invitations).length,
    steps,
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
