import{apiRequest}from"../../api/httpClient";
export interface Organization {
  [key: string]: unknown;
  name: string;
  legalName: string | null;
  organizationCode: string;
  slug: string;
  primaryEmail: string;
  primaryPhone: string | null;
  status: string;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCountry?: string | null;
  stateProvince?: string | null;
  city?: string | null;
  postalCode?: string | null;
  settings: Settings;
}
export interface Settings {
  timeZone: string;
  locale: string;
  country: string;
  currency: string;
  dateFormat?: string;
  workingDays: string[];
  brandingDisplayName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  onboardingAccessDecision?: "SOLO" | null;
  onboardingAccessDecidedAt?: string | null;
  onboardingFinishedAt?: string | null;
}
export interface Member{membershipId:string;email:string;fullName:string;role:string;status:string;joinedAt:string}
export interface Invitation{invitationId:string;email:string;role:string;status:string;expiresAt:string;invitedByEmail:string;createdAt:string;deliveryStatus:string;deliveryError:string|null}
export const getOrganization=()=>apiRequest<Organization>("/api/tenant/organization");
export const updateOrganization=(body:Partial<Organization>)=>apiRequest<Organization>("/api/tenant/organization",{method:"PATCH",body});
export const updateSettings=(body:Partial<Settings>)=>apiRequest<Organization>("/api/tenant/organization/settings",{method:"PATCH",body});
export const confirmSoloAccess=()=>apiRequest<Organization>("/api/tenant/organization/onboarding/solo",{method:"POST"});
export const finishOnboarding=()=>apiRequest<Organization>("/api/tenant/organization/onboarding/finish",{method:"POST",expectedStatuses:[409]});
export const getMembers=()=>apiRequest<Member[]>("/api/tenant/organization/members");
export const changeMemberRole=(id:string,role:string)=>apiRequest<Member>(`/api/tenant/organization/members/${id}/role`,{method:"PATCH",body:{role}});
export const removeMember=(id:string)=>apiRequest<void>(`/api/tenant/organization/members/${id}`,{method:"DELETE"});
export const getInvitations=()=>apiRequest<Invitation[]>("/api/tenant/invitations");
export const createInvitation=(email:string,role:string)=>apiRequest<Invitation>("/api/tenant/invitations",{method:"POST",body:{email,role}});
export const revokeInvitation=(id:string)=>apiRequest<void>(`/api/tenant/invitations/${id}`,{method:"DELETE"});

export const resendInvitation=(id:string)=>apiRequest<Invitation>(`/api/tenant/invitations/${id}/resend`,{method:"POST"});
