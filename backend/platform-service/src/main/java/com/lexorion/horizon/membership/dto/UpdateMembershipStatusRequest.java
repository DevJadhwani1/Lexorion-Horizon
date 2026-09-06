package com.lexorion.horizon.membership.dto;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateMembershipStatusRequest(@NotNull MembershipStatus status) {
}
