package com.lexorion.platform.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {
   private final ObjectMapper objectMapper;

   public JsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
      this.objectMapper = objectMapper;
   }

   public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException {
      response.setStatus(HttpStatus.UNAUTHORIZED.value());
      response.setContentType("application/json");
      this.objectMapper.writeValue(response.getOutputStream(), ApiError.of(HttpStatus.UNAUTHORIZED.value(), HttpStatus.UNAUTHORIZED.getReasonPhrase(), "Authentication is required or the access token is invalid", request.getRequestURI()));
   }
}
