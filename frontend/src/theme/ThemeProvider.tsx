import { createContext,useContext,type ReactNode } from "react";
const t={page:"#f4f6f8",sidebar:"#101828",panel:"#ffffff",field:"#ffffff",ink:"#101828",body:"#344054",muted:"#667085",faint:"#98a2b3",border:"#e4e7ec",borderStrong:"#d0d5dd",accent:"#175cd3",accentFg:"#ffffff"};
const ThemeContext=createContext({t});export function ThemeProvider({children}:{children:ReactNode}){return <ThemeContext.Provider value={{t}}>{children}</ThemeContext.Provider>}export const useTheme=()=>useContext(ThemeContext);
