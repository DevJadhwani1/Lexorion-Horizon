import { createContext,useContext,type ReactNode } from "react";
const t={page:"#f7f7f8",sidebar:"#0b0f17",panel:"#ffffff",field:"#ffffff",ink:"#141a24",body:"#353740",muted:"#6b6f76",faint:"#9a9ca2",border:"#e5e5e7",borderStrong:"#d1d1d4",accent:"#1f6cff",accentFg:"#ffffff"};
const ThemeContext=createContext({t});export function ThemeProvider({children}:{children:ReactNode}){return <ThemeContext.Provider value={{t}}>{children}</ThemeContext.Provider>}export const useTheme=()=>useContext(ThemeContext);
