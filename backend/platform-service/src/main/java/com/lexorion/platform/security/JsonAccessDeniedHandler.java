package com.lexorion.platform.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.exception.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;

public class JsonAccessDeniedHandler implements AccessDeniedHandler {
   private final ObjectMapper objectMapper;

   public JsonAccessDeniedHandler(ObjectMapper objectMapper) {
      this.objectMapper = objectMapper;
   }

   public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException {
      response.setStatus(HttpStatus.FORBIDDEN.value());
      response.setContentType("application/json");
      this.objectMapper.writeValue(response.getOutputStream(), ApiError.of(HttpStatus.FORBIDDEN.value(), HttpStatus.FORBIDDEN.getReasonPhrase(), "You do not have permission to perform this operation", request.getRequestURI()));
   }
}
