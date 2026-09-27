package com.lexorion.core.organization.exception;

public class InvalidTenantSlugException extends RuntimeException {
   public InvalidTenantSlugException(String message) {
      super(message);
   }
}
