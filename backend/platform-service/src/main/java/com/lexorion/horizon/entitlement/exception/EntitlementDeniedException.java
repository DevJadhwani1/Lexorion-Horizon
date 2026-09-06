package com.lexorion.horizon.entitlement.exception;
import org.springframework.security.access.AccessDeniedException;
public class EntitlementDeniedException extends AccessDeniedException { public EntitlementDeniedException(String message) { super(message); } }
