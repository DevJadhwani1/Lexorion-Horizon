package com.lexorion.platform.exception;
import com.lexorion.core.exception.DuplicateResourceException;
import com.lexorion.core.exception.ResourceNotFoundException;

import com.lexorion.core.auth.exception.InvalidCredentialsException;
import com.lexorion.core.auth.exception.InvalidRefreshTokenException;
import com.lexorion.platform.domain.exception.InvalidDomainStateException;
import com.lexorion.platform.domain.exception.InvalidHostnameException;
import com.lexorion.platform.domain.exception.TenantHostnameUnavailableException;
import com.lexorion.horizon.entitlement.exception.InvalidEntitlementValueException;
import com.lexorion.horizon.entitlement.exception.InvalidPlanAssignmentException;
import com.lexorion.horizon.invitation.exception.InvalidInvitationException;
import com.lexorion.horizon.invitation.exception.InvitationConflictException;
import com.lexorion.platform.organization.exception.InvalidLifecycleTransitionException;
import com.lexorion.platform.organization.exception.InvalidTenantSlugException;
import com.lexorion.horizon.organizationsettings.exception.InvalidOrganizationSettingsException;
import com.lexorion.horizon.tenantadmin.exception.TenantAdministrationConflictException;
import com.lexorion.horizon.workspace.exception.InvalidWorkspaceException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
   @ExceptionHandler(IllegalArgumentException.class)
   public ResponseEntity<ApiError> handleInvalidArgument(IllegalArgumentException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidEntitlementValueException.class})
   public ResponseEntity<ApiError> handleInvalidEntitlementValue(InvalidEntitlementValueException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidPlanAssignmentException.class})
   public ResponseEntity<ApiError> handleInvalidPlanAssignment(InvalidPlanAssignmentException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidWorkspaceException.class})
   public ResponseEntity<ApiError> handleInvalidWorkspace(InvalidWorkspaceException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidOrganizationSettingsException.class})
   public ResponseEntity<ApiError> handleInvalidOrganizationSettings(InvalidOrganizationSettingsException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvitationConflictException.class})
   public ResponseEntity<ApiError> handleInvitationConflict(InvitationConflictException ex, HttpServletRequest request) {
      return this.build(HttpStatus.CONFLICT, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidInvitationException.class})
   public ResponseEntity<ApiError> handleInvalidInvitation(InvalidInvitationException ex, HttpServletRequest request) {
      return this.build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
   }

   @ExceptionHandler({TenantAdministrationConflictException.class})
   public ResponseEntity<ApiError> handleTenantAdministrationConflict(TenantAdministrationConflictException ex, HttpServletRequest request) {
      return this.build(HttpStatus.CONFLICT, ex.getMessage(), request);
   }

   @ExceptionHandler({TenantHostnameUnavailableException.class})
   public ResponseEntity<ApiError> handleTenantHostnameUnavailable(TenantHostnameUnavailableException ex, HttpServletRequest request) {
      return this.build(HttpStatus.MISDIRECTED_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidLifecycleTransitionException.class, InvalidTenantSlugException.class, InvalidDomainStateException.class, InvalidHostnameException.class})
   public ResponseEntity<ApiError> handleInvalidOrganizationRequest(RuntimeException ex, HttpServletRequest request) {
      return this.build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidCredentialsException.class})
   public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException ex, HttpServletRequest request) {
      return this.build(HttpStatus.UNAUTHORIZED, ex.getMessage(), request);
   }

   @ExceptionHandler({InvalidRefreshTokenException.class})
   public ResponseEntity<ApiError> handleInvalidRefreshToken(InvalidRefreshTokenException ex, HttpServletRequest request) {
      return this.build(HttpStatus.UNAUTHORIZED, ex.getMessage(), request);
   }

   @ExceptionHandler({ResourceNotFoundException.class})
   public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
      return this.build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
   }

   @ExceptionHandler({DuplicateResourceException.class})
   public ResponseEntity<ApiError> handleDuplicate(DuplicateResourceException ex, HttpServletRequest request) {
      return this.build(HttpStatus.CONFLICT, ex.getMessage(), request);
   }

   @ExceptionHandler({DataIntegrityViolationException.class})
   public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
      return this.build(HttpStatus.CONFLICT, "Request violates a data integrity constraint", request);
   }

   @ExceptionHandler({MethodArgumentNotValidException.class})
   public ResponseEntity<ApiError> handleBodyValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
      List<ApiError.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream().map(GlobalExceptionHandler::toFieldError).toList();
      ApiError body = ApiError.of(HttpStatus.BAD_REQUEST.value(), HttpStatus.BAD_REQUEST.getReasonPhrase(), "Validation failed", request.getRequestURI(), fieldErrors);
      return ResponseEntity.badRequest().body(body);
   }

   @ExceptionHandler({ConstraintViolationException.class})
   public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
      List<ApiError.FieldError> fieldErrors = ex.getConstraintViolations().stream().map((v) -> new ApiError.FieldError(v.getPropertyPath().toString(), v.getMessage())).toList();
      ApiError body = ApiError.of(HttpStatus.BAD_REQUEST.value(), HttpStatus.BAD_REQUEST.getReasonPhrase(), "Validation failed", request.getRequestURI(), fieldErrors);
      return ResponseEntity.badRequest().body(body);
   }

   private static ApiError.FieldError toFieldError(FieldError error) {
      return new ApiError.FieldError(error.getField(), error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage());
   }

   private ResponseEntity<ApiError> build(HttpStatus status, String message, HttpServletRequest request) {
      ApiError body = ApiError.of(status.value(), status.getReasonPhrase(), message, request.getRequestURI());
      return ResponseEntity.status(status).body(body);
   }
}
