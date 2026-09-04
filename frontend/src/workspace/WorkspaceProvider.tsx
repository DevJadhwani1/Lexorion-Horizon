import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from "react";
import { getAccessibleWorkspaces,type OrganizationWorkspace } from "../features/admin/workspaceApi";
import { session } from "../api/session";import { useAuth } from "../auth/AuthProvider";
interface Value{loading:boolean;workspaces:OrganizationWorkspace[];workspace:OrganizationWorkspace|null;selectWorkspace(key:string):void;reload():Promise<void>}
const Context=createContext<Value|null>(null);
export function WorkspaceProvider({children}:{children:ReactNode}){const{organization}=useAuth();const[loading,setLoading]=useState(false),[workspaces,setWorkspaces]=useState<OrganizationWorkspace[]>([]),[key,setKey]=useState(session.workspace());
 const reload=async()=>{if(!organization){setWorkspaces([]);return;}setLoading(true);try{const items=await getAccessibleWorkspaces();setWorkspaces(items);const current=session.workspace();if(current&&!items.some(i=>i.key===current)){session.setWorkspace(null);setKey(null);}}finally{setLoading(false);}};
 useEffect(()=>{void reload();},[organization?.slug]);
 const selectWorkspace=(next:string)=>{session.setWorkspace(next);setKey(next);};const value=useMemo(()=>({loading,workspaces,workspace:workspaces.find(w=>w.key===key)??null,selectWorkspace,reload}),[loading,workspaces,key]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useWorkspace(){const value=useContext(Context);if(!value)throw new Error("WorkspaceProvider is required");return value;}
