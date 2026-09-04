package com.lexorion.platform.domain.exception;

public class OrganizationSelectionDeniedException extends RuntimeException {
   public OrganizationSelectionDeniedException() {
      super("Organization selection is not accessible");
   }
}
