import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser, getOrganizations, loginRequest, logoutRequest, type CurrentUser, type OrganizationMembership } from "./authApi";
import { session } from "../api/session";

interface AuthValue { loading: boolean; user: CurrentUser|null; organizations: OrganizationMembership[]; organization: OrganizationMembership|null; login(email:string,password:string):Promise<void>; logout():Promise<void>; selectOrganization(slug:string):void; reloadOrganizations():Promise<void>; }
const AuthContext=createContext<AuthValue|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
 const [loading,setLoading]=useState(true),[user,setUser]=useState<CurrentUser|null>(null),[organizations,setOrganizations]=useState<OrganizationMembership[]>([]),[slug,setSlug]=useState(session.organization());
 const load=useCallback(async()=>{if(!session.access()){setLoading(false);return;}try{const [me,orgs]=await Promise.all([getCurrentUser(),getOrganizations()]);setUser(me);setOrganizations(orgs.filter(o=>o.membershipStatus==="ACTIVE"));const selected=session.organization();if(selected&&!orgs.some(o=>o.slug===selected)){session.setOrganization(null);session.setWorkspace(null);setSlug(null);}}catch{session.clearTokens();setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const expired=()=>{setUser(null);setOrganizations([]);setSlug(null);};window.addEventListener("lexorion:session-expired",expired);return()=>window.removeEventListener("lexorion:session-expired",expired);},[load]);
 const login=async(email:string,password:string)=>{const tokens=await loginRequest(email,password);session.setTokens(tokens.accessToken,tokens.refreshToken);setLoading(true);await load();};
 const logout=async()=>{const token=session.refresh();try{if(token)await logoutRequest(token);}finally{session.clearTokens();session.setOrganization(null);session.setWorkspace(null);setUser(null);setOrganizations([]);setSlug(null);}};
 const selectOrganization=(next:string)=>{session.setOrganization(next);session.setWorkspace(null);setSlug(next);};
 const value=useMemo(()=>({loading,user,organizations,organization:organizations.find(o=>o.slug===slug)??null,login,logout,selectOrganization,reloadOrganizations:load}),[loading,user,organizations,slug,load]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("AuthProvider is required");return value;}
