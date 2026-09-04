package com.lexorion.workforce.tenant;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
@Component public class TrustedTenantFilter extends OncePerRequestFilter {
    public static final String WORKSPACE_HEADER="X-Lexorion-Workspace";
    private final TenantAuthorityClient authority; private final TrustedWorkforceContextHolder contexts; private final AuthorityRequestContext credentials;
    public TrustedTenantFilter(TenantAuthorityClient authority,TrustedWorkforceContextHolder contexts,AuthorityRequestContext credentials){this.authority=authority;this.contexts=contexts;this.credentials=credentials;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){String uri=request.getRequestURI();return !uri.startsWith("/api/workforce/")&&!uri.matches("^/internal/workforce/employees/[^/]+/verification$");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        String token=request.getHeader(HttpHeaders.AUTHORIZATION), workspace=request.getHeader(WORKSPACE_HEADER);
        if(token==null||!token.startsWith("Bearer ")||workspace==null||!workspace.matches("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")){response.sendError(401,"Trusted workforce context is required");return;}
        try{
            TrustedWorkforceContext context=authority.validate(workspace,token,request.getHeader(HttpHeaders.HOST),request.getHeader("X-Lexorion-Organization"));
            if(context==null||!workspace.equals(context.workspaceKey())){response.sendError(403,"Workspace access denied");return;}
            contexts.set(context); credentials.set(new AuthorityRequestContext.Credentials(token,request.getHeader(HttpHeaders.HOST),request.getHeader("X-Lexorion-Organization"))); SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(context.workspaceKey(),null,List.of(new SimpleGrantedAuthority("ROLE_"+context.role().name())))); chain.doFilter(request,response);
        }catch(RuntimeException ex){response.sendError(403,"Workspace access denied");}finally{contexts.clear();credentials.clear();SecurityContextHolder.clearContext();}
    }
}
