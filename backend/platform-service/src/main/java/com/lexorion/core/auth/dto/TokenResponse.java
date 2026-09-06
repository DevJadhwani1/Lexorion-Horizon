package com.lexorion.core.auth.dto;

import java.time.Instant;

public record TokenResponse(String tokenType, String accessToken, Instant accessTokenExpiresAt, String refreshToken, Instant refreshTokenExpiresAt) {
}
