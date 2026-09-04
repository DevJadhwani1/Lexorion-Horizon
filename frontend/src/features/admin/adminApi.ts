import{apiRequest}from"../../api/httpClient";
export interface Organization{[key:string]:unknown;name:string;legalName:string|null;organizationCode:string;slug:string;primaryEmail:string;primaryPhone:string|null;status:string;description:string|null;industry:string|null;companySize:string|null;website:string|null;settings:Settings}
export interface Settings{timeZone:string;locale:string;country:string;currency:string;workingDays:string[];brandingDisplayName:string|null;primaryColor:string|null;secondaryColor:string|null}
export interface Member{membershipId:string;email:string;fullName:string;role:string;status:string;joinedAt:string}
export interface Invitation{invitationId:string;email:string;role:string;status:string;expiresAt:string;invitedByEmail:string;createdAt:string}
export const getOrganization=()=>apiRequest<Organization>("/api/tenant/organization");
export const updateOrganization=(body:Partial<Organization>)=>apiRequest<Organization>("/api/tenant/organization",{method:"PATCH",body});
export const updateSettings=(body:Partial<Settings>)=>apiRequest<Organization>("/api/tenant/organization/settings",{method:"PATCH",body});
export const getMembers=()=>apiRequest<Member[]>("/api/tenant/organization/members");
export const changeMemberRole=(id:string,role:string)=>apiRequest<Member>(`/api/tenant/organization/members/${id}/role`,{method:"PATCH",body:{role}});
export const removeMember=(id:string)=>apiRequest<void>(`/api/tenant/organization/members/${id}`,{method:"DELETE"});
export const getInvitations=()=>apiRequest<Invitation[]>("/api/tenant/invitations");
export const createInvitation=(email:string,role:string)=>apiRequest<Invitation>("/api/tenant/invitations",{method:"POST",body:{email,role}});
export const revokeInvitation=(id:string)=>apiRequest<void>(`/api/tenant/invitations/${id}`,{method:"DELETE"});
