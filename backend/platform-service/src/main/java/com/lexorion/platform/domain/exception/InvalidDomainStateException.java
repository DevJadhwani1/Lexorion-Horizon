package com.lexorion.platform.domain.exception;

public class InvalidDomainStateException extends RuntimeException {
   public InvalidDomainStateException(String message) {
      super(message);
   }
}
