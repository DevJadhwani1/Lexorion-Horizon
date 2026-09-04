package com.lexorion.platform.exception;

public class ResourceNotFoundException extends RuntimeException {
   public ResourceNotFoundException(String message) {
      super(message);
   }

   public static ResourceNotFoundException of(String resource, Object id) {
      return new ResourceNotFoundException(resource + " not found: " + String.valueOf(id));
   }
}
