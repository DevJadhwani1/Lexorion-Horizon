package com.lexorion.finance.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(FinanceException.class)
    ResponseEntity<?> finance(FinanceException e, HttpServletRequest r) {
        return response(e.status(), e.getMessage(), r);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> invalidBody(MethodArgumentNotValidException e, HttpServletRequest r) {
        var field = e.getBindingResult().getFieldError();
        return response(400, field == null ? "Validation failed" : "Validation failed: " + field.getField() + " " + field.getDefaultMessage(), r);
    }

    @ExceptionHandler({ConstraintViolationException.class, MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> validation(Exception e, HttpServletRequest r) {
        return response(400, "Validation failed", r);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> conflict(Exception e, HttpServletRequest r) {
        return response(409, "Finance data conflicts with an existing record", r);
    }

    private ResponseEntity<?> response(int status, String message, HttpServletRequest r) {
        return ResponseEntity.status(status).body(Map.of("timestamp", Instant.now(), "status", status,
                "errorCode", "LEX-" + status, "message", message, "path", r.getRequestURI(),
                "correlationId", Objects.toString(MDC.get("correlationId"), "")));
    }
}
