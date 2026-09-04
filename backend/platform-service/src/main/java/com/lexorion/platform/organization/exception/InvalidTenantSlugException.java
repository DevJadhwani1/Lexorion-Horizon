package com.lexorion.platform.organization.exception;

public class InvalidTenantSlugException extends RuntimeException {
   public InvalidTenantSlugException(String message) {
      super(message);
   }
}
