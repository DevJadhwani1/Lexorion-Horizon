package com.lexorion.platform.observability;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component @Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class CorrelationIdFilter extends OncePerRequestFilter {
 public static final String HEADER="X-Correlation-ID",MDC_KEY="correlationId";
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String supplied=request.getHeader(HEADER);String id=supplied!=null&&supplied.matches("[A-Za-z0-9._:-]{1,64}")?supplied:UUID.randomUUID().toString();
  response.setHeader(HEADER,id);MDC.put(MDC_KEY,id);try{chain.doFilter(request,response);}finally{MDC.remove(MDC_KEY);}
 }
}
