package com.lexorion.platform.domain.exception;

public class InvalidHostnameException extends RuntimeException {
   public InvalidHostnameException(String message) {
      super(message);
   }
}
