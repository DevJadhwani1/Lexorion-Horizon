package com.lexorion.platform.domain.exception;

public class TenantHostnameUnavailableException extends RuntimeException {
   public TenantHostnameUnavailableException() {
      super("Tenant is unavailable for this hostname");
   }
}
