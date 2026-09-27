import { CoreConsole } from "./core/CoreConsole";
import { isCoreConsole } from "./core/routing";
import{StrictMode}from"react";import{createRoot}from"react-dom/client";import{AuthProvider}from"./auth/AuthProvider";import{ApplicationContextProvider}from"./context/ApplicationContext";import{WorkspaceProvider}from"./workspace/WorkspaceProvider";import{ThemeProvider}from"./theme/ThemeProvider";import{Router}from"./app/Router";import"./styles.css";
createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider>{isCoreConsole() ? <CoreConsole /> : <AuthProvider><ApplicationContextProvider><WorkspaceProvider><Router/></WorkspaceProvider></ApplicationContextProvider></AuthProvider>}</ThemeProvider></StrictMode>);
