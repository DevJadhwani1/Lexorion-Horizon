package com.lexorion.horizon.entitlement.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
public record AssignPlanRequest(@NotBlank @Pattern(regexp = "starter|business") String planKey) { }
