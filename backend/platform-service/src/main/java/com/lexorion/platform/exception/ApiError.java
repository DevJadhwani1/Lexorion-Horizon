package com.lexorion.platform.exception;

import java.time.Instant;
import java.util.List;
import org.slf4j.MDC;

public record ApiError(Instant timestamp, int status, String error, String errorCode, String message, String path, String correlationId, List<FieldError> fieldErrors) {
   public static ApiError of(int status, String error, String message, String path) {
      return new ApiError(Instant.now(), status, error, code(status), message, path, MDC.get("correlationId"), List.of());
   }

   public static ApiError of(int status, String error, String message, String path, List<FieldError> fieldErrors) {
      return new ApiError(Instant.now(), status, error, code(status), message, path, MDC.get("correlationId"), fieldErrors);
   }

   private static String code(int status) { return "LEX-" + status; }

   public static record FieldError(String field, String message) {
   }
}
