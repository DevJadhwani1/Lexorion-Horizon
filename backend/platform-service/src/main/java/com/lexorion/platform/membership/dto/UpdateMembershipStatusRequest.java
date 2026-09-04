package com.lexorion.platform.membership.dto;

import com.lexorion.platform.membership.entity.MembershipStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateMembershipStatusRequest(@NotNull MembershipStatus status) {
}
