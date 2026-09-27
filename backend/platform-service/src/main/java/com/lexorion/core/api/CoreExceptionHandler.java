package com.lexorion.core.api;

import com.lexorion.core.auth.exception.*;
import com.lexorion.core.exception.*;
import com.lexorion.core.organization.exception.*;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(basePackages = "com.lexorion.core")
@Order(0)
public class CoreExceptionHandler {
    @ExceptionHandler({InvalidCredentialsException.class, org.springframework.security.core.AuthenticationException.class})
    ResponseEntity<?> unauthenticated(Exception e) { return error(401, e.getMessage()); }
    @ExceptionHandler(InvalidRefreshTokenException.class)
    ResponseEntity<?> invalidRefresh(InvalidRefreshTokenException e, HttpServletRequest request) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(401);
        String host = request.getServerName().toLowerCase(java.util.Locale.ROOT);
        if (request.getRequestURI().equals("/api/core/auth/refresh") && (host.equals("horizon.lexorion.in") || host.equals("admin.horizon.lexorion.in"))) {
            response.header(HttpHeaders.SET_COOKIE, ResponseCookie.from("lexorion_refresh", "").httpOnly(true).secure(true)
                    .sameSite("Lax").domain(".horizon.lexorion.in").path("/").maxAge(0).build().toString());
        }
        return response.body(Map.of("status", 401, "message", e.getMessage() == null ? "Refresh token is invalid" : e.getMessage()));
    }
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    ResponseEntity<?> denied(Exception e) { return error(403, e.getMessage()); }
    @ExceptionHandler(ResourceNotFoundException.class) ResponseEntity<?> missing(Exception e) { return error(404, e.getMessage()); }
    @ExceptionHandler({DuplicateResourceException.class, org.springframework.dao.DataIntegrityViolationException.class})
    ResponseEntity<?> conflict(Exception e) { return error(409, "The request conflicts with existing data"); }
    @ExceptionHandler({IllegalArgumentException.class, InvalidLifecycleTransitionException.class, InvalidTenantSlugException.class, MethodArgumentNotValidException.class})
    ResponseEntity<?> invalid(Exception e) { return error(400, e instanceof MethodArgumentNotValidException ? "Request validation failed" : e.getMessage()); }
    private ResponseEntity<?> error(int status, String message) { return ResponseEntity.status(status).body(Map.of("status", status, "message", message == null ? "Request failed" : message)); }
}
